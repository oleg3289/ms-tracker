'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Upload, Loader2, CheckCircle2, AlertCircle, ExternalLink, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Tab = 'url' | 'pdf'

interface ExerciseInput {
  name: string; sets: number; reps: string; weight_note: string; rest_seconds: number; notes: string; youtube_url: string
}
interface DayInput { label: string; exercises: ExerciseInput[] }
interface ProgramInput {
  title: string; description: string; duration_weeks: number; days_per_week: number
  level: string; goal: string; days: DayInput[]
}

const emptyExercise = (): ExerciseInput => ({ name: '', sets: 3, reps: '10', weight_note: '', rest_seconds: 90, notes: '', youtube_url: '' })
const emptyDay = (): DayInput => ({ label: '', exercises: [emptyExercise()] })

export function ImportClient() {
  const [tab, setTab] = useState<Tab>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [program, setProgram] = useState<ProgramInput | null>(null)
  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped?.type === 'application/pdf') setFile(dropped)
  }

  const handleScrape = async () => {
    if (!url.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/scrape-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to import')
      setProgram(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePDF = async () => {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse PDF')
      setProgram(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const saveProgram = async () => {
    if (!program) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Insert program
      const { data: prog, error: pe } = await supabase.from('workout_programs').insert({
        user_id: user.id,
        title: program.title,
        description: program.description,
        source_url: tab === 'url' ? url : null,
        source_type: tab,
        duration_weeks: program.duration_weeks,
        days_per_week: program.days_per_week,
        level: program.level,
        goal: program.goal,
      }).select().single()
      if (pe) throw pe

      // Insert days + exercises
      for (let di = 0; di < program.days.length; di++) {
        const d = program.days[di]
        const { data: day, error: de } = await supabase.from('workout_days').insert({
          program_id: prog.id,
          week_number: 1,
          day_number: di + 1,
          label: d.label,
        }).select().single()
        if (de) throw de

        for (let ei = 0; ei < d.exercises.length; ei++) {
          const ex = d.exercises[ei]
          await supabase.from('exercises').insert({
            day_id: day.id,
            sort_order: ei,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight_note: ex.weight_note || null,
            rest_seconds: ex.rest_seconds || null,
            notes: ex.notes || null,
            youtube_url: ex.youtube_url || null,
          })
        }
      }

      router.push(`/workouts/${prog.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const updateExercise = (di: number, ei: number, field: keyof ExerciseInput, value: any) => {
    setProgram(prev => {
      if (!prev) return prev
      const days = [...prev.days]
      const exercises = [...days[di].exercises]
      exercises[ei] = { ...exercises[ei], [field]: value }
      days[di] = { ...days[di], exercises }
      return { ...prev, days }
    })
  }

  const addExercise = (di: number) => {
    setProgram(prev => {
      if (!prev) return prev
      const days = [...prev.days]
      days[di] = { ...days[di], exercises: [...days[di].exercises, emptyExercise()] }
      return { ...prev, days }
    })
  }

  const removeExercise = (di: number, ei: number) => {
    setProgram(prev => {
      if (!prev) return prev
      const days = [...prev.days]
      days[di] = { ...days[di], exercises: days[di].exercises.filter((_, i) => i !== ei) }
      return { ...prev, days }
    })
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {!program && (
        <>
          <div className="flex rounded-xl bg-[#13131f] border border-[#1e2035] p-1">
            {(['url', 'pdf'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                  tab === t ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300')}>
                {t === 'url' ? '🔗 Website URL' : '📄 Upload PDF'}
              </button>
            ))}
          </div>

          {tab === 'url' && (
            <div className="space-y-3">
              <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-3">
                <p className="text-sm text-slate-400">Paste a workout URL from <span className="text-orange-400">muscleandstrength.com</span></p>
                <div className="flex gap-2">
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.muscleandstrength.com/workouts/..."
                    className="flex-1 bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <button onClick={handleScrape} disabled={loading || !url.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors text-sm">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><Link2 className="w-4 h-4" /> Import Workout</>}
                </button>
              </div>
            </div>
          )}

          {tab === 'pdf' && (
            <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-3">
              <p className="text-sm text-slate-400">Upload a workout PDF downloaded from muscleandstrength.com</p>
              <label
                className={cn(
                  'flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors',
                  dragging ? 'border-orange-500 bg-orange-500/10' :
                  file ? 'border-orange-500/40 bg-orange-500/5' : 'border-[#2a2a45] hover:border-[#3a3a55]'
                )}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className={cn('w-8 h-8 mb-2', dragging ? 'text-orange-400' : file ? 'text-orange-400' : 'text-slate-600')} />
                <p className="text-sm font-medium text-slate-300">
                  {dragging ? 'Drop PDF here' : file ? file.name : 'Tap or drag & drop PDF'}
                </p>
                <p className="text-xs text-slate-600 mt-1">{file ? `${(file.size / 1024).toFixed(0)} KB` : 'PDF files only'}</p>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <button onClick={handlePDF} disabled={loading || !file}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors text-sm">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : <><Upload className="w-4 h-4" /> Parse PDF</>}
              </button>
            </div>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Program preview + edit */}
      {program && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm font-medium text-green-400">Program imported successfully — review and save</p>
          </div>

          {/* Program meta */}
          <div className="bg-[#13131f] border border-[#1e2035] rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Program Details</p>
            <input value={program.title} onChange={e => setProgram(p => p ? { ...p, title: e.target.value } : p)}
              className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50" placeholder="Program title" />
            <textarea value={program.description} onChange={e => setProgram(p => p ? { ...p, description: e.target.value } : p)}
              rows={2} className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 resize-none" placeholder="Description" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Weeks', field: 'duration_weeks' as const, type: 'number' },
                { label: 'Days/Week', field: 'days_per_week' as const, type: 'number' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <p className="text-[11px] text-slate-500 mb-1">{label}</p>
                  <input type={type} value={(program as any)[field]} onChange={e => setProgram(p => p ? { ...p, [field]: Number(e.target.value) } : p)}
                    className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50" />
                </div>
              ))}
              <div>
                <p className="text-[11px] text-slate-500 mb-1">Level</p>
                <select value={program.level} onChange={e => setProgram(p => p ? { ...p, level: e.target.value } : p)}
                  className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none">
                  <option value="">Any</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 mb-1">Goal</p>
                <select value={program.goal} onChange={e => setProgram(p => p ? { ...p, goal: e.target.value } : p)}
                  className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none">
                  <option value="">General</option>
                  <option value="strength">Strength</option>
                  <option value="hypertrophy">Hypertrophy</option>
                  <option value="endurance">Endurance</option>
                  <option value="fat_loss">Fat Loss</option>
                </select>
              </div>
            </div>
          </div>

          {/* Days */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{program.days.length} Training Days</p>
            {program.days.map((day, di) => (
              <div key={di} className="bg-[#13131f] border border-[#1e2035] rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedDay(expandedDay === di ? null : di)}
                  className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-orange-400">
                    {di + 1}
                  </div>
                  <span className="flex-1 font-medium text-slate-200 text-sm">{day.label || `Day ${di + 1}`}</span>
                  <span className="text-xs text-slate-600">{day.exercises.length} exercises</span>
                  {expandedDay === di ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {expandedDay === di && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[#1e2035] pt-3">
                    <input value={day.label} onChange={e => setProgram(p => { if (!p) return p; const d = [...p.days]; d[di] = { ...d[di], label: e.target.value }; return { ...p, days: d } })}
                      className="w-full bg-[#0d0d1a] border border-[#1e2035] rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50" placeholder="Day label (e.g. Chest & Triceps)" />

                    {day.exercises.map((ex, ei) => (
                      <div key={ei} className="bg-[#0d0d1a] border border-[#1e2035] rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input value={ex.name} onChange={e => updateExercise(di, ei, 'name', e.target.value)}
                            className="flex-1 bg-transparent border-b border-[#2a2a45] py-1 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50" placeholder="Exercise name" />
                          <button onClick={() => removeExercise(di, ei)} className="text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { label: 'Sets', field: 'sets' as const, type: 'number' },
                            { label: 'Reps', field: 'reps' as const, type: 'text' },
                            { label: 'Rest (s)', field: 'rest_seconds' as const, type: 'number' },
                          ] as const).map(({ label, field, type }) => (
                            <div key={field}>
                              <p className="text-[10px] text-slate-600 mb-1">{label}</p>
                              <input type={type} value={(ex as any)[field]} onChange={e => updateExercise(di, ei, field, type === 'number' ? Number(e.target.value) : e.target.value)}
                                className="w-full bg-[#13131f] border border-[#1e2035] rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none" />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <input value={ex.youtube_url} onChange={e => updateExercise(di, ei, 'youtube_url', e.target.value)}
                            className="flex-1 bg-transparent text-xs text-slate-500 placeholder:text-slate-700 focus:outline-none" placeholder="Guide URL (optional)" />
                        </div>
                      </div>
                    ))}

                    <button onClick={() => addExercise(di)}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-[#2a2a45] rounded-xl py-2.5 text-sm text-slate-600 hover:text-slate-400 hover:border-[#3a3a55] transition-colors">
                      <Plus className="w-4 h-4" /> Add exercise
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save */}
          <button onClick={saveProgram} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : '💾 Save Program'}
          </button>

          <button onClick={() => { setProgram(null); setError(null) }}
            className="w-full text-sm text-slate-600 hover:text-slate-400 py-2 transition-colors">
            ← Start over
          </button>
        </div>
      )}
    </div>
  )
}
