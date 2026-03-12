'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Dumbbell, PlusCircle, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/workouts/import', label: 'Import', icon: PlusCircle },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0d0d1a]/95 backdrop-blur-sm border-t border-[#1e2035] safe-bottom">
      <div className="flex items-stretch max-w-2xl mx-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const isImport = href === '/workouts/import'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors',
                isImport
                  ? 'text-orange-400'
                  : active
                    ? 'text-orange-400'
                    : 'text-slate-600 hover:text-slate-400'
              )}
            >
              {isImport ? (
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center -mt-3 shadow-lg shadow-orange-500/30">
                  <Icon className="w-4 h-4 text-white" />
                </div>
              ) : (
                <Icon className={cn('w-5 h-5', active && 'text-orange-400')} />
              )}
              <span className={cn(isImport && '-mt-1')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
