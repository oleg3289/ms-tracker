import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // seconds

// Allow up to 10 MB – Vercel's default for App Router is 4.5 MB which can
// be too small for image-heavy workout PDFs uploaded over slow mobile connections.
export const runtime = 'nodejs'

// Convert exercise name → muscleandstrength.com guide slug
// "Barbell Bench Press" → "barbell-bench-press"
// "Calf Exercise (choose any exercise)" → "calf-exercise"
function toMsSlug(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, ' ')   // strip parenthetical notes
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function guideUrl(exerciseName: string): string {
  return `https://www.muscleandstrength.com/exercises/${toMsSlug(exerciseName)}.html`
}

function parseSets(s: string): number {
  return parseInt(s.trim()) || 3
}

// "3 - 5" → "3-5",  "10 - 15" → "10-15",  "10" → "10"
function parseReps(s: string): string {
  return s.trim().replace(/\s*-\s*/g, '-') || '10'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    const isPdf =
      file?.type === 'application/pdf' ||
      file?.type === 'application/octet-stream' || // iOS sometimes reports this
      file?.name?.toLowerCase().endsWith('.pdf')
    if (!file || !isPdf) {
      return NextResponse.json({ error: 'Please upload a valid PDF file' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Use lib entry point directly to avoid Vercel serverless issue
    // where pdf-parse/index.js tries to read ./test/data/* relative to process.cwd()
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)

    // Non-empty trimmed lines
    const lines: string[] = data.text
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean)

    // ── 1. Title ──────────────────────────────────────────────────────────────
    // The title appears as 1-2 consecutive ALL-CAPS lines immediately before
    // the "Main Goal:" metadata line (e.g. lines 52-53 in this PDF).
    let title = ''
    const mainGoalIdx = lines.findIndex(l => /^main goal:/i.test(l))
    if (mainGoalIdx >= 1) {
      const titleLines: string[] = []
      for (let i = mainGoalIdx - 1; i >= Math.max(0, mainGoalIdx - 4); i--) {
        const l = lines[i]
        if (l === l.toUpperCase() && l.length > 5 && !/^[®\d]/.test(l)) {
          titleLines.unshift(l)
        } else {
          break
        }
      }
      title = titleLines.join(' ').replace(/\s+/g, ' ').trim()
    }
    if (!title) title = 'Imported Workout'

    // ── 2. Metadata ───────────────────────────────────────────────────────────
    let durationWeeks = 8
    let daysPerWeek = 4
    let level = ''
    let goal = ''
    let description = ''

    for (const line of lines) {
      const weeksM = line.match(/program duration:\s*(\d+)/i)
      if (weeksM) durationWeeks = parseInt(weeksM[1])

      const daysM = line.match(/days per week:\s*(\d+)/i)
      if (daysM) daysPerWeek = parseInt(daysM[1])

      if (/training level:\s*beginner/i.test(line)) level = 'beginner'
      else if (/training level:\s*intermediate/i.test(line)) level = 'intermediate'
      else if (/training level:\s*advanced/i.test(line)) level = 'advanced'

      const goalM = line.match(/main goal:\s*(.+)/i)
      if (goalM) {
        const g = goalM[1].toLowerCase()
        if (g.includes('strength')) goal = 'strength'
        else if (g.includes('muscle') || g.includes('size') || g.includes('hypertrophy') || g.includes('build')) goal = 'hypertrophy'
        else if (g.includes('fat') || g.includes('loss') || g.includes('cut')) goal = 'fat_loss'
        else if (g.includes('endurance')) goal = 'endurance'
      }
    }

    // Description: the pitch paragraph that usually follows the M&S header block
    const descIdx = lines.findIndex(l => /^build\s+both|^build\s+/i.test(l))
    if (descIdx !== -1) {
      const descParts: string[] = []
      for (let i = descIdx; i < Math.min(descIdx + 5, lines.length); i++) {
        if (/^(day\s*\d|exercise|main goal|training level|program duration|link to)/i.test(lines[i])) break
        descParts.push(lines[i])
      }
      description = descParts.join(' ').trim()
    }

    // ── 3. Exercise days ──────────────────────────────────────────────────────
    const days: { label: string; exercises: any[] }[] = []
    let currentDay: { label: string; exercises: any[] } | null = null

    // Lines to skip entirely
    const skipPat = /^(ExerciseSetsReps|MUSCLEANDSTRENGTH|THE TOOLS|THE BODY|Store.*Workouts|®|Link to Workout|https?:|strength\.com|:$)/i

    // Day header: "Day 1", "Day 2", etc.
    const dayPat = /^day\s*\d+$/i

    // Section subtitle within a day: "Upper Power", "Lower Hypertrophy", etc.
    const subtitlePat = /^(upper|lower|push|pull|legs?|full\s*body)\s+(power|hypertrophy|body)?.*$/i

    // Exercise line: text ending in a letter or ")" immediately followed (no space) by
    // sets (number or range) then reps (number or range).
    // Examples:
    //   "Barbell Bench Press3 - 43 - 5"
    //   "Calf Exercise (choose any exercise)46 - 10"
    //   "Skullcrusher2 - 36 - 10"
    const exPat = /^(.*[a-zA-Z\)])\s*(\d+(?:\s*-\s*\d+)?)\s*(\d+(?:\s*-\s*\d+)?)\s*$/

    // Metadata keys that can appear after exercise sections — skip them
    const metaPat = /^(main goal|training level|program duration|days per week|time per workout|equipment|author):/i

    for (const line of lines) {
      if (skipPat.test(line)) continue
      if (metaPat.test(line)) continue

      if (dayPat.test(line)) {
        if (currentDay && currentDay.exercises.length > 0) days.push(currentDay)
        currentDay = { label: line, exercises: [] }
        continue
      }

      if (!currentDay) continue

      // Section subtitle → append to day label
      if (subtitlePat.test(line) && !exPat.test(line)) {
        const baseName = currentDay.label.replace(/\s*[–-].*$/, '').trim()
        currentDay.label = `${baseName} – ${line.trim()}`
        continue
      }

      // Skip description / prose lines that appear after Day 5
      if (line.length > 80) continue

      // Try to parse as exercise
      const m = line.match(exPat)
      if (m) {
        const rawName = m[1].trim()
        const setsStr = m[2]
        const repsStr = m[3]
        currentDay.exercises.push({
          name: rawName,
          sets: parseSets(setsStr),
          reps: parseReps(repsStr),
          weight_note: '',
          rest_seconds: 90,
          notes: '',
          youtube_url: guideUrl(rawName),
        })
      }
    }

    if (currentDay && currentDay.exercises.length > 0) days.push(currentDay)

    // Fallback
    if (days.length === 0) {
      days.push({
        label: 'Day 1',
        exercises: [{
          name: 'Exercise 1', sets: 3, reps: '10',
          weight_note: '', rest_seconds: 90,
          notes: 'Auto-parse failed. Please edit exercises manually.',
          youtube_url: '',
        }],
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
    return NextResponse.json(
      { error: 'Failed to parse PDF. Please check the file and try again.' },
      { status: 500 }
    )
  }
}
