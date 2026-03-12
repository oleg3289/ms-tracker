import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusCircle, BookOpen, Calendar, Dumbbell } from 'lucide-react'
import { DeleteProgramButton } from '@/components/workout/DeleteProgramButton'

export default async function WorkoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: programs } = await supabase
    .from('workout_programs')
    .select('*, workout_days(id)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const { data: plans } = await supabase
    .from('workout_plans')
    .select('*, workout_programs(title)')
    .eq('user_id', user!.id)
    .eq('active', true)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">My Programs</h1>
        <Link href="/workouts/import" className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition-colors">
          <PlusCircle className="w-4 h-4" />
          Import
        </Link>
      </div>

      {/* Active plans */}
      {plans && plans.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Plans</p>
          <div className="space-y-2">
            {plans.map((plan: any) => (
              <div key={plan.id} className="bg-[#13131f] border border-orange-500/20 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-100 text-sm truncate">{plan.workout_programs?.title}</p>
                  <p className="text-xs text-slate-500">Started {new Date(plan.start_date).toLocaleDateString()}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wide">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Programs */}
      {programs && programs.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">All Programs</p>
          <div className="space-y-2">
            {programs.map((program: any) => (
              <div key={program.id} className="relative flex items-stretch bg-[#13131f] border border-[#1e2035] rounded-2xl overflow-hidden card-hover">
                <Link href={`/workouts/${program.id}`} className="flex-1 p-4 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1a1a2e] flex items-center justify-center flex-shrink-0">
                      <Dumbbell className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 text-sm leading-tight">{program.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {program.workout_days?.length ?? 0} days · {program.duration_weeks ?? '?'}wk · {program.level ?? 'Any level'}
                      </p>
                      {program.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{program.description}</p>
                      )}
                    </div>
                    <BookOpen className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                  </div>
                </Link>
                <div className="flex items-center pr-3">
                  <DeleteProgramButton programId={program.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#13131f] border border-dashed border-[#2a2a45] rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-300 font-semibold mb-1">No programs yet</p>
          <p className="text-sm text-slate-500 mb-4">Import a workout from muscleandstrength.com or upload a PDF</p>
          <Link href="/workouts/import" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <PlusCircle className="w-4 h-4" /> Import Program
          </Link>
        </div>
      )}
    </div>
  )
}
