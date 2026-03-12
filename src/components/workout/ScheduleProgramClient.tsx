'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, CheckCircle2, AlertTriangle, CalendarPlus, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addDays, toDateString } from '@/lib/utils'
import type { WorkoutPlan } from '@/types/database'

interface DayMeta { id: string; label: string | null; day_number: number }

interface Props {
  programId: string
  activePlan: WorkoutPlan | null
  durationWeeks: number
  calendarConnected: boolean
  days: DayMeta[]
}

const DAYS_OF_WEEK = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

function nextOccurrence(targetDay: number): string {
  const today = new Date()
  const diff = (targetDay - today.getDay() + 7) % 7
  return toDateString(addDays(today, diff))
}

export function ScheduleProgramClient({ programId, activePlan, durationWeeks, calendarConnected, days }: Props) {
  const [selectedDay, setSelectedDay] = useState(1)
  const [startDate, setStartDate] = useState(() => nextOccurrence(1))
  const [syncCalendar, setSyncCalendar] = useState(calendarConnected)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState(60)

  // Mid-program state
  const [midProgram, setMidProgram] = useState(false)
  const [startWeek, setStartWeek] = useState(1)
  const [startDayIndex, setStartDayIndex] = useState(0) // 0-based index into days[]

  const router = useRouter()
  const supabase = createClient()

  const handleCalendarSync = async (planId: string) => {
    setSyncing(true)
    setConflict(null)
    try {
      const calRes = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, reminderMinutes }),
      })
      if (!calRes.ok) {
        const d = await calRes.json()
        setConflict(d.error ?? 'Calendar sync failed')
      } else {
        setSyncDone(true)
      }
    } catch {
      setConflict('Calendar sync failed — check your connection and try again.')
    } finally {
      setSyncing(false)
    }
  }

  if (activePlan) {
    const end = activePlan.end_date ? new Date(activePlan.end_date).toLocaleDateString() : '–'
    return (
      <div className="space-y-2">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-400">Program is active</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Started {new Date(activePlan.start_date).toLocaleDateString()} · Ends {end}
            </p>
          </div>
        </div>
        {calendarConnected && !syncDone && (
          <button
            onClick={() => handleCalendarSync(activePlan.id)}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-[#13131f] border border-[#1e2035] hover:border-orange-500/30 text-slate-400 hover:text-slate-200 text-sm py-2.5 rounded-xl transition-colors"
          >
            {syncing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing to Google Calendar…</>
              : <><CalendarPlus className="w-4 h-4 text-orange-400" /> Sync workouts to Google Calendar</>
            }
          </button>
        )}
        {syncDone && (
          <div className="flex items-center gap-2 text-xs text-green-400 px-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Synced to Google Calendar
          </div>
        )}
        {conflict && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400">{conflict}</p>
          </div>
        )}
      </div>
    )
  }

  const handleSchedule = async () => {
    setLoading(true); setConflict(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const start = new Date(startDate)

      // How many calendar weeks remain from the chosen start point
      const remainingWeeks = midProgram
        ? durationWeeks - startWeek + 1
        : durationWeeks

      const endDate = toDateString(addDays(start, remainingWeeks * 7))

      // Deactivate any existing active plans
      await supabase
        .from('workout_plans')
        .update({ active: false })
        .eq('user_id', user.id)
        .eq('active', true)

      const { data: plan, error: pe } = await supabase.from('workout_plans').insert({
        user_id: user.id,
        program_id: programId,
        start_date: startDate,
        end_date: endDate,
        calendar_synced: false,
        active: true,
      }).select().single()
      if (pe) throw pe

      // Fetch days in order
      const { data: programDays } = await supabase
        .from('workout_days')
        .select('*')
        .eq('program_id', programId)
        .order('day_number')

      if (programDays && programDays.length > 0) {
        const sessions = []
        let dayIdx = midProgram ? startDayIndex : 0

        // Place exactly daysPerWeek workouts per 7-day cycle using a
        // split pattern that respects built-in rest days (e.g. PHUL 2+2).
        // Offsets are calendar-day positions within each 7-day block:
        //   2 days → [0, 1]
        //   3 days → [0, 1, 3]          (2+1 with a gap)
        //   4 days → [0, 1, 4, 5]       (2+2 with 2-day gap)  ← PHUL
        //   5 days → [0, 1, 2, 4, 5]    (3+2 with 1-day gap)
        //   6 days → [0, 1, 2, 3, 4, 5] (consecutive)
        const n = programDays.length
        const offsetMap: Record<number, number[]> = {
          1: [0],
          2: [0, 1],
          3: [0, 1, 3],
          4: [0, 1, 4, 5],
          5: [0, 1, 2, 4, 5],
          6: [0, 1, 2, 3, 4, 5],
        }
        const offsets = offsetMap[n] ?? Array.from({ length: Math.min(n, 7) }, (_, i) => i)

        for (let week = 0; week < remainingWeeks; week++) {
          for (const offset of offsets) {
            sessions.push({
              plan_id: plan.id,
              day_id: programDays[dayIdx].id,
              user_id: user.id,
              scheduled_date: toDateString(addDays(start, week * 7 + offset)),
              completed: false,
            })
            dayIdx = (dayIdx + 1) % n
          }
        }

        if (sessions.length > 0) {
          await supabase.from('workout_sessions').insert(sessions)
        }
      }

      if (syncCalendar) {
        const calRes = await fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id, reminderMinutes }),
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

  const currentDayLabel = days[startDayIndex]?.label ?? `Day ${startDayIndex + 1}`

  return (
    <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-4">
      <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-orange-400" /> Schedule This Program
      </p>

      {/* Start day of week */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 block">First workout day</label>
        <div className="grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => {
                setSelectedDay(d.value)
                setStartDate(nextOccurrence(d.value))
              }}
              className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                selectedDay === d.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#0d0d1a] text-slate-500 hover:text-slate-300 border border-[#1e2035]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Starting{' '}
          <span className="text-slate-300 font-medium">
            {new Date(startDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long', month: 'short', day: 'numeric',
            })}
          </span>
        </p>
      </div>

      {/* Mid-program toggle */}
      <div className="border border-[#1e2035] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setMidProgram(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>Already started this program?</span>
          {midProgram
            ? <ChevronUp className="w-4 h-4 text-orange-400" />
            : <ChevronDown className="w-4 h-4" />}
        </button>

        {midProgram && (
          <div className="px-4 pb-4 space-y-4 border-t border-[#1e2035] pt-3">
            <p className="text-xs text-slate-500">Pick up where you left off — only the remaining sessions will be scheduled.</p>

            {/* Week picker */}
            <div className="space-y-2">
              <label className="text-xs text-slate-500 block">Current week</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStartWeek(w => Math.max(1, w - 1))}
                  className="w-9 h-9 rounded-xl bg-[#0d0d1a] border border-[#1e2035] text-slate-400 hover:text-white text-lg leading-none flex items-center justify-center transition-colors"
                >−</button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold text-slate-100">{startWeek}</span>
                  <span className="text-xs text-slate-500 ml-1">/ {durationWeeks}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStartWeek(w => Math.min(durationWeeks, w + 1))}
                  className="w-9 h-9 rounded-xl bg-[#0d0d1a] border border-[#1e2035] text-slate-400 hover:text-white text-lg leading-none flex items-center justify-center transition-colors"
                >+</button>
              </div>
            </div>

            {/* Day picker */}
            {days.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-slate-500 block">Next workout</label>
                <div className="space-y-1.5">
                  {days.map((d, i) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setStartDayIndex(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                        startDayIndex === i
                          ? 'bg-orange-500/15 border border-orange-500/40 text-orange-300'
                          : 'bg-[#0d0d1a] border border-[#1e2035] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        startDayIndex === i ? 'bg-orange-500/30 text-orange-300' : 'bg-[#1a1a2e] text-slate-500'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="truncate">{d.label ?? `Day ${i + 1}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-[#0d0d1a] rounded-xl px-3 py-2.5 text-xs text-slate-500">
              Scheduling from <span className="text-slate-300 font-medium">Week {startWeek} · {currentDayLabel}</span>
              {' '}— <span className="text-slate-300 font-medium">
                {(durationWeeks - startWeek) * days.length + (days.length - startDayIndex)} sessions
              </span> remaining
            </div>
          </div>
        )}
      </div>

      {/* Google Calendar toggle + reminder picker */}
      <div className="space-y-3">
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

        {syncCalendar && (
          <div className="space-y-1.5 pl-1">
            <p className="text-xs text-slate-500">Remind me before each workout</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'None', value: 0 },
                { label: '15 min', value: 15 },
                { label: '30 min', value: 30 },
                { label: '1 hour', value: 60 },
                { label: '2 hours', value: 120 },
                { label: '1 day', value: 1440 },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReminderMinutes(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    reminderMinutes === opt.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-[#0d0d1a] border border-[#1e2035] text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
