'use client'

import { User } from '@supabase/supabase-js'
import { Dumbbell } from 'lucide-react'
import Image from 'next/image'

interface Props { user: User }

export function TopBar({ user }: Props) {
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? ''
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0a0a0f]/90 backdrop-blur-sm border-b border-[#1e2035]">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
          <Dumbbell className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-slate-100 text-sm">WorkoutTracker</span>
      </div>
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={32}
            height={32}
            className="rounded-full ring-2 ring-[#1e2035]"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        )}
      </div>
    </header>
  )
}
