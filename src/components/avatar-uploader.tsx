'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ImageUp, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateAvatarUrl } from '@/app/actions/profile'
import { Avatar } from '@/components/ui/avatar'
import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { toast } from '@/components/ui/toast'

// Los mismos límites que el bucket `avatars` en Supabase: si no coinciden, el
// servidor rechazaría la subida después de hacer esperar al usuario.
const MAX_BYTES = 2 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const ACCEPTED = Object.keys(EXTENSIONS)

function validate(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Formato no admitido. Usa JPG, PNG, WEBP o GIF.'
  if (file.size > MAX_BYTES) return 'La imagen no puede pesar más de 2 MB.'
  return null
}

function hasFiles(e: React.DragEvent | DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

export function AvatarUploader({
  userId,
  name,
  initialUrl,
  onChange,
}: {
  userId: string
  /** Para las iniciales cuando no hay foto. */
  name: string
  initialUrl: string | null
  /**
   * `shown` es lo que se ve ahora (puede ser la previsualización local) y
   * `saved`, la URL pública que ya está guardada en el perfil.
   */
  onChange?: (shown: string | null, saved: string | null) => void
}) {
  const [saved, setSaved] = useState(initialUrl)
  // Previsualización local (blob:). Se mantiene también tras subir: es la misma
  // imagen y evita el parpadeo mientras llega la versión remota.
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // dragenter/dragleave saltan en cada hijo: se cuenta la profundidad.
  const depth = useRef(0)
  const hintId = useId()

  const shown = preview ?? saved

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => {
    onChangeRef.current?.(shown, saved)
  }, [shown, saved])

  // Libera la previsualización anterior al cambiarla y al salir de la página.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // Soltar una imagen fuera de la zona haría que el navegador la abriera y se
  // perdieran los cambios sin guardar del formulario.
  useEffect(() => {
    function block(e: DragEvent) {
      if (!hasFiles(e) || e.defaultPrevented) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  function fail(message: string) {
    setError(message)
    toast(message, { tone: 'error' })
  }

  async function upload(file: File) {
    if (busy) return
    setError(null)
    const problem = validate(file)
    if (problem) {
      fail(problem)
      return
    }

    setPreview(URL.createObjectURL(file))
    setBusy('upload')
    try {
      const supabase = createClient()
      // La política de Storage exige que la primera carpeta sea el uuid propio.
      // La extensión sale del tipo MIME: el nombre del archivo puede no tenerla.
      const path = `${userId}/${Date.now()}.${EXTENSIONS[file.type]}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })
      if (uploadError) throw new Error('No se pudo subir la imagen. Inténtalo de nuevo.')

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const res = await updateAvatarUrl(data.publicUrl)
      if (res.error) throw new Error(res.error)

      setSaved(data.publicUrl)
      toast('Foto de perfil actualizada', { tone: 'success' })
    } catch (err) {
      // Vuelve a la foto guardada: la nueva no ha llegado a guardarse. (La
      // previsualización anterior ya se liberó al cambiarla.)
      setPreview(null)
      fail(err instanceof Error && err.message ? err.message : 'No se pudo subir la imagen. Inténtalo de nuevo.')
    } finally {
      setBusy(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    if (busy) return
    setError(null)
    setBusy('remove')
    try {
      const res = await updateAvatarUrl(null)
      if (res.error) {
        fail(res.error)
        return
      }
      setSaved(null)
      setPreview(null)
      toast('Foto de perfil eliminada', { tone: 'success' })
    } catch {
      fail('No se pudo quitar la foto. Inténtalo de nuevo.')
    } finally {
      setBusy(null)
    }
  }

  function onDragEnter(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth.current += 1
    setDragging(true)
  }

  function onDragOver(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = busy ? 'none' : 'copy'
  }

  function onDragLeave(e: React.DragEvent) {
    if (!hasFiles(e)) return
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void upload(file)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div
      data-dragging={dragging || undefined}
      aria-busy={busy ? true : undefined}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="settings-drop flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-line p-4 text-center sm:flex-row sm:p-5 sm:text-left"
    >
      <button
        type="button"
        onClick={openPicker}
        disabled={Boolean(busy)}
        aria-describedby={hintId}
        aria-label={saved ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
        className="settings-drop-avatar group relative shrink-0 rounded-full"
      >
        <Avatar src={shown} name={name} size={96} className="shadow-card" />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Camera size={24} />
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-bg-elevated/70 backdrop-blur-[2px]">
            <PokeballSpinner size={34} label={busy === 'upload' ? 'Subiendo foto…' : 'Quitando foto…'} />
          </span>
        )}
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full border-2 border-surface bg-brand text-brand-fg shadow-card"
        >
          <Camera size={15} />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {dragging ? (
            <span className="text-brand">Suelta la imagen para usarla</span>
          ) : (
            <>
              Arrastra una imagen aquí <span className="font-normal text-muted">o elígela desde tu dispositivo</span>
            </>
          )}
        </p>
        <p id={hintId} className="mt-0.5 text-xs text-muted">
          JPG, PNG, WEBP o GIF · máximo 2 MB. Se guarda en cuanto termina de subir.
        </p>

        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <button type="button" onClick={openPicker} disabled={Boolean(busy)} className="btn btn-soft btn-sm">
            <ImageUp aria-hidden size={16} />
            {saved ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {saved && (
            <button
              type="button"
              onClick={remove}
              disabled={Boolean(busy)}
              className="btn btn-ghost btn-sm text-muted hover:text-danger"
            >
              <Trash2 aria-hidden size={16} />
              Quitar
            </button>
          )}
        </div>

        {error && (
          <p className="mt-2 animate-fade-in text-xs font-medium text-danger">{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />
    </div>
  )
}
