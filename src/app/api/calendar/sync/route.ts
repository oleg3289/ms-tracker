import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Read the Google access token stored at login time
    const { data: profile, error: pe } = await supabase
      .from('profiles')
      .select('google_access_token, google_token_expiry')
      .eq('id', user.id)
      .single()

    if (pe || !profile?.google_access_token) {
      return NextResponse.json(
        { error: 'Google Calendar not connected. Go to Settings → Connect Google Calendar.' },
        { status: 400 },
      )
    }

    // Check if token is expired (with 60s buffer)
    const expiry = profile.google_token_expiry ?? 0
    if (Date.now() >= expiry - 60_000) {
      return NextResponse.json(
        { error: 'Google token expired. Go to Settings → reconnect Google Calendar, then try again.' },
        { status: 400 },
      )
    }

    const accessToken = profile.google_access_token

    // Load upcoming workout sessions for this plan
    const { data: workoutSessions, error: se } = await supabase
      .from('workout_sessions')
      .select('*, workout_days(label, exercises(name))')
      .eq('plan_id', planId)
      .eq('completed', false)

    if (se) throw se

    const created: string[] = []
    const failed: string[] = []

    for (const ws of workoutSessions ?? []) {
      const date = ws.scheduled_date
      const label = (ws as any).workout_days?.label ?? 'Workout'
      const exercises = ((ws as any).workout_days?.exercises ?? [])
        .map((e: any) => e.name)
        .slice(0, 5)

      const event = {
        summary: `💪 ${label}`,
        description: exercises.length > 0
          ? `Exercises:\n${exercises.map((e: string) => `• ${e}`).join('\n')}`
          : 'Workout session',
        start: { date },
        end: { date },
        colorId: '6', // tangerine / orange
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 60 }],
        },
      }

      try {
        const gcRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          },
        )

        if (gcRes.ok) {
          const gcEvent = await gcRes.json()
          await supabase
            .from('workout_sessions')
            .update({ calendar_event_id: gcEvent.id })
            .eq('id', ws.id)
          created.push(ws.id)
        } else {
          const errBody = await gcRes.json().catch(() => ({}))
          console.error('Google Calendar event error:', gcRes.status, errBody)
          // 401 means token expired on Google's side too
          if (gcRes.status === 401) {
            return NextResponse.json(
              { error: 'Google token expired. Go to Settings → reconnect Google Calendar, then try again.' },
              { status: 400 },
            )
          }
          failed.push(ws.id)
        }
      } catch (err) {
        console.error('Google Calendar fetch error:', err)
        failed.push(ws.id)
      }
    }

    // Mark plan as synced
    await supabase
      .from('workout_plans')
      .update({ calendar_synced: true })
      .eq('id', planId)

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
