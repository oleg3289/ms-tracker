'use client'

import { useEffect } from 'react'

/**
 * Forces the browser to check for a new service worker on every page load.
 * Without this, browsers may not check for SW updates for up to 24 hours.
 * Combined with skipWaiting + clientsClaim in workboxOptions, this ensures
 * the latest SW (including API-route fixes) activates without requiring
 * users to manually clear site data.
 */
export function SwUpdater() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((registration) => {
      registration.update().catch(() => {
        // Ignore update check errors — they're non-critical
      })
    })
  }, [])

  return null
}
