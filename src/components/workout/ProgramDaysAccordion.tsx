'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Youtube, Dumbbell } from 'lucide-react'
import { cn, parseYouTubeId } from '@/lib/utils'
import type { WorkoutDay, Exercise } from '@/types/database'

interface Props {
  days: (WorkoutDay & { exercises: Exercise[] })[]
}

export function ProgramDaysAccordion({ days }: Props) {
  const [expanded, setExpanded] = useState<string | null>(days[0]?.id ?? null)

  return (
    <div className="space-y-2">
      {days.map((day, i) => (
        <div key={day.id} className="bg-[#13131f] border border-[#1e2035] rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === day.id ? null : day.id)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-xs font-bold text-orange-400 flex-shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-200 text-sm">{day.label ?? `Day ${i + 1}`}</p>
              <p className="text-xs text-slate-500">{day.exercises?.length ?? 0} exercises</p>
            </div>
            {expanded === day.id
              ? <ChevronUp className="w-4 h-4 text-slate-500" />
              : <ChevronDown className="w-4 h-4 text-slate-500" />
            }
          </button>

          {expanded === day.id && (
            <div className="px-4 pb-4 space-y-2 border-t border-[#1e2035] pt-3">
              {day.notes && <p className="text-xs text-slate-500 italic">{day.notes}</p>}
              {(day.exercises ?? []).map((ex, ei) => {
                const ytId = parseYouTubeId(ex.youtube_url ?? '')
                return (
                  <div key={ex.id} className="flex items-start gap-3 py-2 border-b border-[#0d0d1a] last:border-0">
                    <div className="w-6 h-6 rounded-md bg-[#1a1a2e] flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0 mt-0.5">
                      {ei + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{ex.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ex.sets} sets × {ex.reps} reps
                        {ex.weight_note && ` · ${ex.weight_note}`}
                        {ex.rest_seconds && ` · ${ex.rest_seconds}s rest`}
                      </p>
                      {ex.notes && <p className="text-xs text-slate-600 mt-0.5 italic">{ex.notes}</p>}
                    </div>
                    {ytId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${ytId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-500 hover:text-red-400 flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <Youtube className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
