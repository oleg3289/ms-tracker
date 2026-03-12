'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteProgramButton({ programId }: { programId: string }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm) {
      setConfirm(true)
      // Auto-reset confirm state after 3s if user doesn't tap again
      setTimeout(() => setConfirm(false), 3000)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch {
      setLoading(false)
      setConfirm(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`p-2 rounded-xl transition-all flex-shrink-0 ${
        confirm
          ? 'bg-red-500/20 text-red-400 scale-110'
          : 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
      }`}
      title={confirm ? 'Tap again to confirm delete' : 'Delete program'}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Trash2 className="w-4 h-4" />
      }
    </button>
  )
}
