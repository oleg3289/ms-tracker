import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScheduleProgramClient } from '@/components/workout/ScheduleProgramClient'
import { ProgramDaysAccordion } from '@/components/workout/ProgramDaysAccordion'
import { CalendarDays, Target, Layers } from 'lucide-react'

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: program } = await supabase
    .from('workout_programs')
    .select(`*, workout_days(*, exercises(*))`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!program) notFound()

  const { data: activePlan } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('program_id', id)
    .eq('active', true)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_calendar_connected')
    .eq('id', user.id)
    .single()

  const days = program.workout_days ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 leading-tight">{program.title}</h1>
        {program.description && <p className="text-sm text-slate-500 mt-1">{program.description}</p>}
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        {program.duration_weeks && (
          <span className="flex items-center gap-1.5 text-xs bg-[#1a1a2e] text-slate-400 px-3 py-1.5 rounded-full">
            <CalendarDays className="w-3.5 h-3.5" /> {program.duration_weeks} weeks
          </span>
        )}
        {program.days_per_week && (
          <span className="flex items-center gap-1.5 text-xs bg-[#1a1a2e] text-slate-400 px-3 py-1.5 rounded-full">
            <Layers className="w-3.5 h-3.5" /> {program.days_per_week} days/week
          </span>
        )}
        {program.goal && (
          <span className="flex items-center gap-1.5 text-xs bg-orange-500/10 text-orange-400 px-3 py-1.5 rounded-full">
            <Target className="w-3.5 h-3.5" /> {program.goal}
          </span>
        )}
        {program.level && (
          <span className="text-xs bg-[#1a1a2e] text-slate-400 px-3 py-1.5 rounded-full capitalize">
            {program.level}
          </span>
        )}
      </div>

      {/* Schedule or active plan status */}
      <ScheduleProgramClient
        programId={program.id}
        activePlan={activePlan}
        durationWeeks={program.duration_weeks ?? 8}
        calendarConnected={profile?.google_calendar_connected ?? false}
        days={days.sort((a, b) => a.day_number - b.day_number).map(d => ({ id: d.id, label: d.label, day_number: d.day_number }))}
      />

      {/* Days accordion */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {days.length} Training Days
        </p>
        <ProgramDaysAccordion days={days as any} />
      </div>
    </div>
  )
}
