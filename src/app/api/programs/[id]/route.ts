import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify ownership before deleting anything
    const { data: program } = await supabase
      .from('workout_programs')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete dependents in order: sessions → plans → exercises → days → program
    const { data: plans } = await supabase
      .from('workout_plans')
      .select('id')
      .eq('program_id', id)

    if (plans && plans.length > 0) {
      const planIds = plans.map(p => p.id)
      await supabase.from('workout_sessions').delete().in('plan_id', planIds)
      await supabase.from('workout_plans').delete().in('id', planIds)
    }

    const { data: days } = await supabase
      .from('workout_days')
      .select('id')
      .eq('program_id', id)

    if (days && days.length > 0) {
      await supabase.from('exercises').delete().in('day_id', days.map(d => d.id))
    }

    await supabase.from('workout_days').delete().eq('program_id', id)
    await supabase.from('workout_programs').delete().eq('id', id).eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Delete failed' }, { status: 500 })
  }
}
