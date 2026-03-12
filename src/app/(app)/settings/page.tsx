import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/layout/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and integrations</p>
      </div>
      <SettingsClient user={user!} profile={profile} />
    </div>
  )
}
