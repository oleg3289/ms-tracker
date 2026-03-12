import { createClient } from '@/lib/supabase/server'
import { TodayWorkout } from '@/components/workout/TodayWorkout'
import { ActivePlanCard } from '@/components/workout/ActivePlanCard'
import { WeekStreak } from '@/components/workout/WeekStreak'
import { toDateString } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = toDateString(new Date())

  // Get active plan
  const { data: activePlan } = await supabase
    .from('workout_plans')
    .select('*, workout_programs(*)')
    .eq('user_id', user!.id)
    .eq('active', true)
    .single()

  // Get today's session
  const { data: todaySession } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_days(*, exercises(*, exercise_logs(*)))
    `)
    .eq('user_id', user!.id)
    .eq('scheduled_date', today)
    .single()

  // Get recent sessions for streak
  const { data: recentSessions } = await supabase
    .from('workout_sessions')
    .select('scheduled_date, completed')
    .eq('user_id', user!.id)
    .gte('scheduled_date', toDateString(new Date(Date.now() - 7 * 86400000)))
    .order('scheduled_date', { ascending: false })

  const firstName = (user!.user_metadata?.full_name as string)?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {todaySession ? "Here's your workout for today" : "No workout scheduled today"}
        </p>
      </div>

      {/* Week streak */}
      <WeekStreak sessions={recentSessions ?? []} />

      {/* Today's workout or empty state */}
      {todaySession ? (
        <TodayWorkout session={todaySession as any} />
      ) : activePlan ? (
        <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-6 text-center">
          <div className="text-3xl mb-2">🏖️</div>
          <p className="text-slate-300 font-medium">Rest day</p>
          <p className="text-sm text-slate-500 mt-1">Enjoy the recovery — you earned it.</p>
        </div>
      ) : (
        <div className="bg-[#13131f] border border-dashed border-[#2a2a45] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-slate-300 font-semibold mb-1">No active program</p>
          <p className="text-sm text-slate-500 mb-4">Import a workout program to get started</p>
          <a href="/workouts/import" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            Import Program
          </a>
        </div>
      )}

      {/* Active plan card */}
      {activePlan && <ActivePlanCard plan={activePlan as any} />}
    </div>
  )
}
