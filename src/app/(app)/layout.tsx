import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { TopBar } from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <TopBar user={user} />
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 max-w-2xl mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
