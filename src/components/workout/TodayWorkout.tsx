'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Circle, Youtube, ChevronDown, ChevronUp, Clock, Dumbbell, Loader2 } from 'lucide-react'
import { cn, parseYouTubeId } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutSession, WorkoutDay, Exercise, ExerciseLog } from '@/types/database'

type SessionWithDay = WorkoutSession & {
  workout_days: (WorkoutDay & {
    exercises: (Exercise & { exercise_logs: ExerciseLog[] })[]
  }) | null
}

interface Props { session: SessionWithDay }

export function TodayWorkout({ session }: Props) {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
  const [localLogs, setLocalLogs] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    session.workout_days?.exercises?.forEach(ex => {
      ex.exercise_logs?.forEach(log => {
        map[`${ex.id}-${log.set_number}`] = log.completed
      })
    })
    return map
  })
  const [completed, setCompleted] = useState(session.completed)
  const [expandedEx, setExpandedEx] = useState<string | null>(null)
  const [completingSession, setCompletingSession] = useState(false)

  const day = session.workout_days
  const exercises = day?.exercises ?? []

  const totalSets = exercises.reduce((s, e) => s + (e.sets ?? 1), 0)
  const doneSets = Object.values(localLogs).filter(Boolean).length
  const progress = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  const toggleSet = async (exerciseId: string, setNumber: number, exerciseLogId?: string) => {
    const key = `${exerciseId}-${setNumber}`
    const newVal = !localLogs[key]
    setLocalLogs(prev => ({ ...prev, [key]: newVal }))

    startTransition(async () => {
      // Upsert exercise log
      await supabase.from('exercise_logs').upsert({
        ...(exerciseLogId ? { id: exerciseLogId } : {}),
        session_id: session.id,
        exercise_id: exerciseId,
        set_number: setNumber,
        completed: newVal,
      })
    })
  }

  const completeSession = async () => {
    setCompletingSession(true)
    await supabase.from('workout_sessions').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', session.id)
    setCompleted(true)
    setCompletingSession(false)
  }

  if (completed) {
    return (
      <div className="bg-[#13131f] border border-green-500/20 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-green-400 font-semibold text-lg">Workout Complete!</p>
        <p className="text-sm text-slate-500 mt-1">Great work today. Rest up!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Today</p>
            <h2 className="font-semibold text-slate-100">{day?.label ?? 'Workout'}</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-400">{progress}%</p>
            <p className="text-[11px] text-slate-500">{doneSets}/{totalSets} sets</p>
          </div>
        </div>
        <div className="h-2 bg-[#1e2035] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Exercises */}
      {exercises.map(exercise => {
        const sets = exercise.sets ?? 1
        const isExpanded = expandedEx === exercise.id
        const ytId = parseYouTubeId(exercise.youtube_url ?? '')
        const exDone = Array.from({ length: sets }, (_, i) => localLogs[`${exercise.id}-${i + 1}`]).filter(Boolean).length
        const allDone = exDone === sets

        return (
          <div
            key={exercise.id}
            className={cn(
              'bg-[#13131f] border rounded-2xl overflow-hidden transition-all',
              allDone ? 'border-green-500/20' : 'border-[#1e2035]'
            )}
          >
            {/* Exercise header */}
            <button
              onClick={() => setExpandedEx(isExpanded ? null : exercise.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                allDone ? 'bg-green-500/15' : 'bg-orange-500/10'
              )}>
                {allDone
                  ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                  : <Dumbbell className="w-5 h-5 text-orange-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-medium text-sm leading-tight', allDone ? 'text-slate-400 line-through' : 'text-slate-100')}>
                  {exercise.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sets} sets · {exercise.reps ?? '—'} reps
                  {exercise.weight_note && ` · ${exercise.weight_note}`}
                  {exercise.rest_seconds && ` · ${exercise.rest_seconds}s rest`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-500">{exDone}/{sets}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>

            {/* Expanded: sets + video */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#1e2035] pt-3">
                {/* Sets checkboxes */}
                <div className="space-y-2">
                  {Array.from({ length: sets }, (_, i) => {
                    const setNum = i + 1
                    const logKey = `${exercise.id}-${setNum}`
                    const isDone = localLogs[logKey] ?? false
                    const existingLog = exercise.exercise_logs?.find(l => l.set_number === setNum)
                    return (
                      <button
                        key={setNum}
                        onClick={() => toggleSet(exercise.id, setNum, existingLog?.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
                          isDone ? 'bg-green-500/10' : 'bg-[#0d0d1a] hover:bg-[#1a1a2e]'
                        )}
                      >
                        <div className={cn('exercise-checkbox', isDone && 'checked')}>
                          {isDone && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className={cn('text-sm flex-1', isDone ? 'text-slate-500 line-through' : 'text-slate-300')}>
                          Set {setNum} — {exercise.reps ?? '—'} reps
                          {exercise.weight_note ? ` @ ${exercise.weight_note}` : ''}
                        </span>
                        {isDone && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      </button>
                    )
                  })}
                </div>

                {/* Notes */}
                {exercise.notes && (
                  <p className="text-xs text-slate-500 italic px-1">{exercise.notes}</p>
                )}

                {/* YouTube video */}
                {ytId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${ytId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Youtube className="w-4 h-4 flex-shrink-0" />
                    <span>Watch exercise guide</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Complete button */}
      <button
        onClick={completeSession}
        disabled={completingSession || progress < 100}
        className={cn(
          'w-full py-4 rounded-2xl font-semibold text-sm transition-all',
          progress === 100
            ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
            : 'bg-[#1e2035] text-slate-500 cursor-not-allowed'
        )}
      >
        {completingSession ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Completing…
          </span>
        ) : progress === 100 ? (
          '🎯 Complete Workout'
        ) : (
          `Complete all sets first (${progress}%)`
        )}
      </button>
    </div>
  )
}
