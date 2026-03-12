import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const maxDuration = 60 // seconds (Vercel Hobby max)

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || !url.includes('muscleandstrength.com')) {
      return NextResponse.json({ error: 'Please provide a valid muscleandstrength.com URL' }, { status: 400 })
    }

    // Strip tracking/analytics params that can trigger Cloudflare challenges
    let cleanUrl: string
    try {
      const parsed = new URL(url)
      for (const key of [...parsed.searchParams.keys()]) {
        if (key.startsWith('_') || key.startsWith('utm_') || key === 'fbclid') {
          parsed.searchParams.delete(key)
        }
      }
      cleanUrl = parsed.toString()
    } catch {
      cleanUrl = url
    }

    const res = await fetch(cleanUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    })

    if (!res.ok) {
      const hint = res.status === 403
        ? 'The site blocked the import request. Try downloading the page as a PDF (File → Print → Save as PDF) and use the PDF import option instead.'
        : `Failed to fetch page (${res.status})`
      return NextResponse.json({ error: hint }, { status: 502 })
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    // Extract program title
    const title = $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') || 'Imported Workout'

    // Extract description
    const description = $('meta[property="og:description"]').attr('content') ||
      $('.field-name-body p').first().text().trim() || ''

    // Extract program meta (duration, level, etc.)
    let durationWeeks = 8
    let daysPerWeek = 4
    let level = ''
    let goal = ''

    // Try to find duration weeks in text
    $('*').each((_, el) => {
      const text = $(el).text().toLowerCase()
      const weekMatch = text.match(/(\d+)\s*week/)
      if (weekMatch && !$(el).children().length) durationWeeks = parseInt(weekMatch[1])
      if (text.includes('beginner')) level = 'beginner'
      else if (text.includes('intermediate')) level = 'intermediate'
      else if (text.includes('advanced')) level = 'advanced'
      if (text.includes('strength')) goal = 'strength'
      else if (text.includes('mass') || text.includes('hypertrophy') || text.includes('muscle')) goal = 'hypertrophy'
      else if (text.includes('fat loss') || text.includes('cutting')) goal = 'fat_loss'
      else if (text.includes('endurance')) goal = 'endurance'
    })

    // Extract workout days and exercises
    const days: { label: string; exercises: any[] }[] = []

    // Look for workout day tables or sections
    // muscleandstrength.com uses various structures, try common selectors
    const dayHeaders: string[] = []
    const dayExerciseSets: any[][] = []

    // Strategy 1: Find tables with exercise data
    $('table').each((tableIdx, table) => {
      const rows = $(table).find('tr')
      if (rows.length < 2) return

      const headerText = $(table).prev('h3, h2, h4, strong').text().trim() ||
        $(table).closest('.view-row, .field-item').prev().text().trim() ||
        `Day ${tableIdx + 1}`

      const exercises: any[] = []
      rows.each((ri, row) => {
        if (ri === 0) return // skip header row
        const cells = $(row).find('td')
        if (cells.length < 2) return
        const name = cells.eq(0).text().trim()
        if (!name || name.toLowerCase() === 'exercise') return

        const setsText = cells.eq(1).text().trim()
        const repsText = cells.eq(2).text().trim()
        const restText = cells.eq(3)?.text()?.trim() || ''

        const setsNum = parseInt(setsText) || 3
        const restSec = restText.match(/(\d+)/)?.[1] ? parseInt(restText.match(/(\d+)/)![1]) : 90

        exercises.push({
          name,
          sets: setsNum,
          reps: repsText || '10',
          weight_note: '',
          rest_seconds: restSec,
          notes: '',
          youtube_url: '',
        })
      })

      if (exercises.length > 0) {
        dayHeaders.push(headerText)
        dayExerciseSets.push(exercises)
      }
    })

    // Strategy 2: Look for .workout-day, .day-section, or similar divs
    if (dayHeaders.length === 0) {
      $('[class*="day"], [class*="workout"], .view-rows .views-row').each((i, el) => {
        const label = $(el).find('h2, h3, h4, .day-title, strong').first().text().trim() || `Day ${i + 1}`
        const exercises: any[] = []

        $(el).find('li, .exercise-row').each((_, exEl) => {
          const name = $(exEl).find('.exercise-name, a').first().text().trim() || $(exEl).text().trim()
          if (name.length > 3) {
            exercises.push({
              name,
              sets: 3,
              reps: '10',
              weight_note: '',
              rest_seconds: 90,
              notes: '',
              youtube_url: '',
            })
          }
        })

        if (exercises.length > 0) {
          dayHeaders.push(label)
          dayExerciseSets.push(exercises)
        }
      })
    }

    // Build days array
    for (let i = 0; i < dayHeaders.length; i++) {
      days.push({ label: dayHeaders[i], exercises: dayExerciseSets[i] })
    }

    // If we couldn't parse days, create a placeholder
    if (days.length === 0) {
      days.push({
        label: 'Day 1 – Full Body',
        exercises: [
          { name: 'Squat', sets: 3, reps: '10', weight_note: '', rest_seconds: 90, notes: 'Could not auto-parse. Edit manually.', youtube_url: '' },
          { name: 'Bench Press', sets: 3, reps: '10', weight_note: '', rest_seconds: 90, notes: '', youtube_url: '' },
          { name: 'Deadlift', sets: 3, reps: '8', weight_note: '', rest_seconds: 120, notes: '', youtube_url: '' },
        ],
      })
    }

    return NextResponse.json({
      title,
      description,
      duration_weeks: durationWeeks,
      days_per_week: daysPerWeek,
      level,
      goal,
      days,
    })
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json({ error: 'Failed to import workout. Try the PDF option instead.' }, { status: 500 })
  }
}
