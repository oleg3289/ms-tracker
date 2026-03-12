'use client'

import { cn } from '@/lib/utils'

interface Session { scheduled_date: string; completed: boolean }
interface Props { sessions: Session[] }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekStreak({ sessions }: Props) {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const session = sessions.find(s => s.scheduled_date === dateStr)
    const isToday = d.toDateString() === today.toDateString()
    const isPast = d < today && !isToday
    return { label: DAYS[i], dateStr, session, isToday, isPast }
  })

  const completed = sessions.filter(s => s.completed).length

  return (
    <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Week</p>
        <p className="text-xs text-slate-500">{completed} completed</p>
      </div>
      <div className="flex gap-1.5">
        {days.map(({ label, session, isToday, isPast }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'w-full h-8 rounded-lg flex items-center justify-center',
                session?.completed
                  ? 'bg-orange-500'
                  : session && !session.completed && isPast
                    ? 'bg-[#1e2035] border border-red-500/30'
                    : session && isToday
                      ? 'bg-orange-500/20 border border-orange-500/40'
                      : session
                        ? 'bg-orange-500/10 border border-orange-500/20'
                        : 'bg-[#0d0d1a]'
              )}
            >
              {session?.completed && <span className="text-white text-xs">✓</span>}
              {session && !session.completed && isToday && <span className="text-orange-400 text-xs">•</span>}
              {session && !session.completed && !isToday && !isPast && <span className="text-orange-400/50 text-xs">·</span>}
            </div>
            <span className={cn(
              'text-[10px]',
              isToday ? 'text-orange-400 font-semibold'
              : session && !session.completed && !isPast ? 'text-orange-400/60'
              : 'text-slate-600'
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
