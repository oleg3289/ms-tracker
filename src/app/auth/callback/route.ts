import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Persist Google tokens so the sync API can use them server-side.
      // provider_token / provider_refresh_token are only available right here,
      // immediately after the OAuth exchange — not in later server-side sessions.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // expires_in is typically 3600 seconds; store as absolute Unix ms
          const expiresIn = (session as any).expires_in ?? 3600
          await supabase.from('profiles').update({
            google_access_token: session.provider_token,
            google_refresh_token: session.provider_refresh_token ?? null,
            google_token_expiry: Date.now() + expiresIn * 1000,
            google_calendar_connected: true,
          }).eq('id', user.id)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
