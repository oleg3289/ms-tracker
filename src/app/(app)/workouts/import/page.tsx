import { ImportClient } from '@/components/workout/ImportClient'

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Import Program</h1>
        <p className="text-sm text-slate-500 mt-0.5">From muscleandstrength.com or a PDF file</p>
      </div>
      <ImportClient />
    </div>
  )
}
