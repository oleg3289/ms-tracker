import { createClient } from '@/lib/supabase/server'
import { StatsClient } from '@/components/workout/StatsClient'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, scheduled_date, completed, duration_minutes')
    .eq('user_id', user!.id)
    .order('scheduled_date', { ascending: false })
    .limit(60)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Statistics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your training progress over time</p>
      </div>
      <StatsClient sessions={sessions ?? []} />
    </div>
  )
}
