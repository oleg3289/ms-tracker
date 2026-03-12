'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addDays, toDateString } from '@/lib/utils'
import type { WorkoutPlan } from '@/types/database'

interface Props {
  programId: string
  activePlan: WorkoutPlan | null
  durationWeeks: number
  calendarConnected: boolean
}

export function ScheduleProgramClient({ programId, activePlan, durationWeeks, calendarConnected }: Props) {
  const [startDate, setStartDate] = useState(toDateString(new Date()))
  const [syncCalendar, setSyncCalendar] = useState(calendarConnected)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  if (activePlan) {
    const end = activePlan.end_date ? new Date(activePlan.end_date).toLocaleDateString() : '–'
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-400">Program is active</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Started {new Date(activePlan.start_date).toLocaleDateString()} · Ends {end}
          </p>
        </div>
      </div>
    )
  }

  const handleSchedule = async () => {
    setLoading(true); setConflict(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const start = new Date(startDate)
      const endDate = toDateString(addDays(start, durationWeeks * 7))

      const { data: plan, error: pe } = await supabase.from('workout_plans').insert({
        user_id: user.id,
        program_id: programId,
        start_date: startDate,
        end_date: endDate,
        calendar_synced: false,
        active: true,
      }).select().single()
      if (pe) throw pe

      // Create workout sessions
      const { data: days } = await supabase
        .from('workout_days')
        .select('*')
        .eq('program_id', programId)
        .order('day_number')

      if (days && days.length > 0) {
        const sessions = []
        let dayIdx = 0
        for (let d = 0; d < durationWeeks * 7; d++) {
          const sessionDate = addDays(start, d)
          // Simple round-robin: assign days sequentially, skip rest
          if (dayIdx < days.length) {
            const dayOfWeek = sessionDate.getDay()
            // Skip weekends for rest (simple heuristic)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              sessions.push({
                plan_id: plan.id,
                day_id: days[dayIdx].id,
                user_id: user.id,
                scheduled_date: toDateString(sessionDate),
                completed: false,
              })
              dayIdx = (dayIdx + 1) % days.length
            }
          }
        }
        if (sessions.length > 0) {
          await supabase.from('workout_sessions').insert(sessions)
        }
      }

      // Sync to Google Calendar if requested
      if (syncCalendar) {
        const calRes = await fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id }),
        })
        if (!calRes.ok) {
          setConflict('Calendar sync failed — workouts are saved but not in your calendar yet.')
        }
      }

      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (e: any) {
      setConflict(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="font-semibold text-green-400">Program scheduled!</p>
        <p className="text-xs text-slate-500 mt-1">Redirecting to dashboard…</p>
      </div>
    )
  }

  return (
    <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-4">
      <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-orange-400" /> Schedule This Program
      </p>

      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 [color-scheme:dark]"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <div onClick={() => setSyncCalendar(s => !s)}
          className={`w-10 h-6 rounded-full transition-colors ${syncCalendar ? 'bg-orange-500' : 'bg-[#2a2a45]'} flex items-center px-1`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${syncCalendar ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
        <span className="text-sm text-slate-400">Sync to Google Calendar</span>
        {!calendarConnected && (
          <span className="text-[10px] text-slate-600">(connect in Settings)</span>
        )}
      </label>

      {conflict && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400">{conflict}</p>
        </div>
      )}

      <button onClick={handleSchedule} disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling…</> : '🗓️ Start Program'}
      </button>
    </div>
  )
}
