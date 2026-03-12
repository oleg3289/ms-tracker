'use client'

import { CalendarDays, Target } from 'lucide-react'
import type { WorkoutPlan, WorkoutProgram } from '@/types/database'

interface Props {
  plan: WorkoutPlan & { workout_programs: WorkoutProgram }
}

export function ActivePlanCard({ plan }: Props) {
  const program = plan.workout_programs
  // Parse start_date ("YYYY-MM-DD") as local midnight, not UTC midnight.
  // new Date("YYYY-MM-DD") parses as UTC, which is ahead of local time for
  // UTC+ users — causing daysIn = -1, Week 0, and -1% on the first day.
  const [sy, sm, sd] = plan.start_date.split('-').map(Number)
  const startDate = new Date(sy, sm - 1, sd)   // local midnight
  const today = new Date()
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysIn = Math.floor((todayLocal.getTime() - startDate.getTime()) / 86400000)
  const totalDays = (program.duration_weeks ?? 0) * 7
  const progress = totalDays > 0
    ? Math.min(100, Math.max(0, Math.round((daysIn / totalDays) * 100)))
    : 0

  return (
    <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Active Program</p>
          <h3 className="font-semibold text-slate-100 leading-tight">{program.title}</h3>
        </div>
        <span className={`text-[10px] font-medium px-2 py-1 rounded-full uppercase tracking-wide
          ${program.level === 'beginner' ? 'bg-green-500/15 text-green-400' :
            program.level === 'intermediate' ? 'bg-blue-500/15 text-blue-400' :
            'bg-purple-500/15 text-purple-400'}`}>
          {program.level ?? 'Any'}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" />
          {program.duration_weeks}wk program
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3.5 h-3.5" />
          {program.goal ?? 'General fitness'}
        </span>
      </div>

      {totalDays > 0 && (
        <div>
          <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
            <span>Week {Math.max(1, Math.floor(daysIn / 7) + 1)}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-[#1e2035] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
