import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SwUpdater } from '@/components/SwUpdater'

export const metadata: Metadata = {
  title: 'WorkoutTracker',
  description: 'Track your workouts, sync with Google Calendar',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WorkoutTracker',
  },
}

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-[#0a0a0f] text-slate-100 antialiased">
        <SwUpdater />
        {children}
      </body>
    </html>
  )
}
