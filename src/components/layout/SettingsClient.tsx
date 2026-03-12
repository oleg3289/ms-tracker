'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, Calendar, CheckCircle2, ExternalLink } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import Image from 'next/image'

interface Props { user: SupabaseUser; profile: Profile | null }

export function SettingsClient({ user, profile }: Props) {
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const name = (user.user_metadata?.full_name as string) ?? user.email ?? 'User'
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const connectCalendar = async () => {
    // Re-trigger Google OAuth with calendar scope
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/settings`,
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Profile */}
      <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} width={52} height={52} className="rounded-full ring-2 ring-[#2a2a45]" />
          ) : (
            <div className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-100">{name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Integrations</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1a1a2e] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Google Calendar</p>
              <p className="text-xs text-slate-500">Sync workouts to your calendar</p>
            </div>
          </div>
          {profile?.google_calendar_connected ? (
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" /> Connected
            </div>
          ) : (
            <button onClick={connectCalendar}
              className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg font-medium transition-colors">
              Connect
            </button>
          )}
        </div>
      </div>

      {/* About */}
      <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">About</p>
        <a href="https://www.muscleandstrength.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <span>Workout source: muscleandstrength.com</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <p className="text-xs text-slate-600">WorkoutTracker v1.0.0</p>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 py-3 rounded-2xl text-sm font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        {signingOut ? 'Signing out…' : 'Sign Out'}
      </button>
    </div>
  )
}
