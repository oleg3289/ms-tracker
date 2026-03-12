import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json()
    const supabase = await createClient()

    // Get user + their Google token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const providerToken = session.provider_token
    if (!providerToken) {
      return NextResponse.json({ error: 'Google Calendar not connected. Please reconnect your Google account.' }, { status: 400 })
    }

    // Get the sessions to sync
    const { data: workoutSessions, error: se } = await supabase
      .from('workout_sessions')
      .select('*, workout_days(label, exercises(name))')
      .eq('plan_id', planId)
      .eq('completed', false)

    if (se) throw se

    // Create Google Calendar events
    const created: string[] = []
    const failed: string[] = []

    for (const ws of workoutSessions ?? []) {
      const date = ws.scheduled_date
      const label = (ws as any).workout_days?.label ?? 'Workout'
      const exercises = ((ws as any).workout_days?.exercises ?? []).map((e: any) => e.name).slice(0, 5)

      const event = {
        summary: `💪 ${label}`,
        description: exercises.length > 0
          ? `Exercises:\n${exercises.map((e: string) => `• ${e}`).join('\n')}`
          : 'Workout session',
        start: { date, timeZone: 'UTC' },
        end: { date, timeZone: 'UTC' },
        colorId: '6', // tangerine/orange
        reminders: {
          useDefault: false,
          overrides: [{ method: 'notification', minutes: 60 }],
        },
      }

      try {
        const gcRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${providerToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        )

        if (gcRes.ok) {
          const gcEvent = await gcRes.json()
          // Update session with calendar event ID
          await supabase
            .from('workout_sessions')
            .update({ calendar_event_id: gcEvent.id })
            .eq('id', ws.id)
          created.push(ws.id)
        } else {
          failed.push(ws.id)
        }
      } catch {
        failed.push(ws.id)
      }
    }

    // Mark plan as calendar synced
    await supabase
      .from('workout_plans')
      .update({ calendar_synced: true })
      .eq('id', planId)

    // Update profile
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ google_calendar_connected: true }).eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      failed: failed.length,
    })
  } catch (error: any) {
    console.error('Calendar sync error:', error)
    return NextResponse.json({ error: error.message ?? 'Calendar sync failed' }, { status: 500 })
  }
}
