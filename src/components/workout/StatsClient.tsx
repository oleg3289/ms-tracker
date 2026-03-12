'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Flame, TrendingUp, CalendarCheck, Clock } from 'lucide-react'

interface Session {
  id: string
  scheduled_date: string
  completed: boolean
  duration_minutes: number | null
}

interface Props { sessions: Session[] }

const tooltipStyle = {
  backgroundColor: '#13131f',
  border: '1px solid #1e2035',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
}

export function StatsClient({ sessions }: Props) {
  const stats = useMemo(() => {
    const completed = sessions.filter(s => s.completed)
    const totalWorkouts = completed.length
    const totalScheduled = sessions.length

    // Streak
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 60; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const session = sessions.find(s => s.scheduled_date === dateStr)
      if (session?.completed) streak++
      else if (session && !session.completed && i > 0) break
      else if (!session && i > 0) break
    }

    // Completion rate
    const completionRate = totalScheduled > 0 ? Math.round((totalWorkouts / totalScheduled) * 100) : 0

    // Avg duration
    const withDuration = completed.filter(s => s.duration_minutes)
    const avgDuration = withDuration.length > 0
      ? Math.round(withDuration.reduce((s, w) => s + w.duration_minutes!, 0) / withDuration.length)
      : 0

    // Weekly activity (last 8 weeks)
    const weeklyData: { week: string; count: number }[] = []
    for (let w = 7; w >= 0; w--) {
      const start = new Date()
      start.setDate(start.getDate() - w * 7 - start.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      const weekSessions = completed.filter(s => {
        const d = new Date(s.scheduled_date)
        return d >= start && d <= end
      })
      const label = start.toLocaleDateString('en', { month: 'short', day: 'numeric' })
      weeklyData.push({ week: label, count: weekSessions.length })
    }

    // Calendar heatmap (last 30 days)
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (29 - i))
      const dateStr = d.toISOString().split('T')[0]
      const session = sessions.find(s => s.scheduled_date === dateStr)
      return {
        date: dateStr,
        completed: session?.completed ?? false,
        scheduled: !!session,
      }
    })

    return { totalWorkouts, completionRate, streak, avgDuration, weeklyData, last30 }
  }, [sessions])

  const kpis = [
    { label: 'Total Workouts', value: stats.totalWorkouts, icon: CalendarCheck, color: 'text-green-400' },
    { label: 'Current Streak', value: `${stats.streak}d`, icon: Flame, color: 'text-orange-400' },
    { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Avg Duration', value: stats.avgDuration ? `${stats.avgDuration}m` : '—', icon: Clock, color: 'text-purple-400' },
  ]

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 30-day heatmap */}
      <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Last 30 Days</p>
        <div className="grid grid-cols-10 gap-1.5">
          {stats.last30.map(({ date, completed, scheduled }) => (
            <div
              key={date}
              title={date}
              className={`h-7 rounded-md ${
                completed ? 'bg-orange-500' :
                scheduled ? 'bg-[#2a1a1a] border border-red-500/20' :
                'bg-[#1a1a2e]'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span className="text-[11px] text-slate-500">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#1a1a2e]" />
            <span className="text-[11px] text-slate-500">Rest/no session</span>
          </div>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Weekly Workouts</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.weeklyData} margin={{ left: -15, right: 5 }}>
            <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#e2e8f0' }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v) => [v, 'Workouts']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {stats.weeklyData.map((_, i) => (
                <Cell key={i} fill={i === stats.weeklyData.length - 1 ? '#f97316' : '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No workout data yet. Start a program to see your stats here!
        </div>
      )}
    </div>
  )
}
