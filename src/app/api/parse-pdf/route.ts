import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // seconds

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Please upload a valid PDF file' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Use lib entry point directly to avoid Vercel serverless issue
    // where pdf-parse/index.js tries to read ./test/data/* relative to process.cwd()
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    const text = data.text

    // Parse the text to extract workout structure
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    const title = lines[0] || 'PDF Workout Program'
    let description = ''
    let durationWeeks = 8
    let daysPerWeek = 4
    let level = ''
    let goal = ''

    // Extract meta from text
    for (const line of lines.slice(0, 20)) {
      const lower = line.toLowerCase()
      if (lower.includes('week')) {
        const m = lower.match(/(\d+)\s*week/)
        if (m) durationWeeks = parseInt(m[1])
      }
      if (lower.includes('beginner')) level = 'beginner'
      else if (lower.includes('intermediate')) level = 'intermediate'
      else if (lower.includes('advanced')) level = 'advanced'
      if (lower.includes('strength')) goal = 'strength'
      else if (lower.includes('mass') || lower.includes('muscle') || lower.includes('hypertrophy')) goal = 'hypertrophy'
      else if (lower.includes('fat loss') || lower.includes('cutting')) goal = 'fat_loss'
    }

    if (lines[1] && !lines[1].match(/^\d/)) description = lines[1]

    // Try to detect day sections and exercises
    const days: { label: string; exercises: any[] }[] = []
    let currentDay: { label: string; exercises: any[] } | null = null

    // Common day patterns: "Day 1", "Monday", "Workout A", etc.
    const dayPattern = /^(day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|workout\s*[a-z])/i
    // Exercise pattern: typically has numbers (sets x reps)
    const exercisePattern = /(\d+)\s*[x×]\s*(\d+[-–]\d+|\d+)|\bsets?\b|\breps?\b/i

    for (const line of lines) {
      if (dayPattern.test(line)) {
        if (currentDay && currentDay.exercises.length > 0) {
          days.push(currentDay)
        }
        currentDay = { label: line, exercises: [] }
      } else if (currentDay && line.length > 3) {
        // Try to extract exercise info
        const setsMatch = line.match(/(\d+)\s*sets?/i)
        const repsMatch = line.match(/(\d+[-–]?\d*)\s*reps?/i) || line.match(/(\d+)\s*[x×]\s*(\d+[-–]\d+|\d+)/)
        const restMatch = line.match(/(\d+)\s*s(?:ec)?(?:onds?)?\s*rest/i)

        if (setsMatch || repsMatch || exercisePattern.test(line)) {
          // This looks like an exercise line
          const name = line.replace(/\d+\s*sets?|\d+\s*reps?|\d+\s*[x×]\s*[\d-–]+|\d+s\s*rest/gi, '').trim()
          if (name.length > 2) {
            currentDay.exercises.push({
              name: name.replace(/^[-•*]\s*/, '').trim(),
              sets: setsMatch ? parseInt(setsMatch[1]) : (repsMatch ? 3 : 3),
              reps: repsMatch ? repsMatch[0].replace(/sets?/gi, '').trim() : '10',
              weight_note: '',
              rest_seconds: restMatch ? parseInt(restMatch[1]) : 90,
              notes: '',
              youtube_url: '',
            })
          }
        } else if (!dayPattern.test(line) && line.length > 5 && line.length < 60 && currentDay.exercises.length < 20) {
          // Might be an exercise name without explicit sets/reps
          currentDay.exercises.push({
            name: line.replace(/^[-•*\d.]\s*/, '').trim(),
            sets: 3,
            reps: '10',
            weight_note: '',
            rest_seconds: 90,
            notes: '',
            youtube_url: '',
          })
        }
      }
    }

    if (currentDay && currentDay.exercises.length > 0) {
      days.push(currentDay)
    }

    // Fallback if we couldn't parse anything meaningful
    if (days.length === 0) {
      days.push({
        label: 'Day 1 – Full Body',
        exercises: [
          { name: 'Exercise 1', sets: 3, reps: '10', weight_note: '', rest_seconds: 90, notes: 'Auto-parse failed. Please edit exercises manually.', youtube_url: '' },
          { name: 'Exercise 2', sets: 3, reps: '10', weight_note: '', rest_seconds: 90, notes: '', youtube_url: '' },
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
    console.error('PDF parse error:', error)
    return NextResponse.json({ error: 'Failed to parse PDF. Please check the file and try again.' }, { status: 500 })
  }
}
