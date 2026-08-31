'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Loader2, Trash2, Upload, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateAvatarUrl } from '@/app/actions/profile'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function AvatarUploader({
  userId,
  initialUrl,
}: {
  userId: string
  initialUrl: string | null
}) {
  const [url, setUrl] = useState(initialUrl)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(file: File) {
    setError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError('Formato no admitido. Usa JPG, PNG, WEBP o GIF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen no puede pesar más de 2 MB.')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      // La política de Storage exige que la primera carpeta sea el uuid propio.
      const path = `${userId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true })

      if (uploadError) {
        setError('No se pudo subir la imagen. Inténtalo de nuevo.')
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = data.publicUrl

      startTransition(async () => {
        const res = await updateAvatarUrl(publicUrl)
        if (res.error) setError(res.error)
        else setUrl(publicUrl)
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onRemove() {
    setError(null)
    startTransition(async () => {
      const res = await updateAvatarUrl(null)
      if (res.error) setError(res.error)
      else setUrl(null)
    })
  }

  const busy = uploading || pending

  return (
    <div className="flex items-center gap-4">
      <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-muted shadow-card">
        {url ? (
          <Image src={url} alt="Tu foto de perfil" width={80} height={80} unoptimized className="h-full w-full object-cover" />
        ) : (
          <User size={34} />
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-black/50 text-white">
            <Loader2 size={20} className="animate-spin" />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold shadow-card transition hover:bg-line disabled:opacity-60"
          >
            <Upload size={15} /> Subir foto
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-red-500/50 hover:text-red-500 disabled:opacity-60"
            >
              <Trash2 size={15} /> Quitar
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">JPG, PNG, WEBP o GIF · máximo 2 MB.</p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPick(file)
        }}
      />
    </div>
  )
}
