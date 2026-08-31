'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Send, Trash2, User } from 'lucide-react'
import { addComment, deleteComment } from '@/app/actions/social'
import { timeAgo } from '@/lib/format'

export interface CommentItem {
  id: string
  body: string
  created_at: string
  author: { id: string; username: string; avatar_url: string | null }
}

export function Comments({
  teamId,
  comments,
  me,
}: {
  teamId: string
  comments: CommentItem[]
  me: { id: string; username: string; avatar_url: string | null }
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Un solo reductor para alta y baja: así el borrado también es optimista y la
  // lista no espera al viaje de ida y vuelta al servidor.
  type Change = { type: 'add'; comment: CommentItem } | { type: 'remove'; id: string }

  const [list, apply] = useOptimistic(comments, (prev, change: Change) =>
    change.type === 'add'
      ? [...prev, change.comment]
      : prev.filter((c) => c.id !== change.id),
  )

  function onSubmit(formData: FormData) {
    const body = String(formData.get('body') ?? '').trim()
    if (!body) return
    formRef.current?.reset()
    setError(null)

    startTransition(async () => {
      apply({
        type: 'add',
        comment: {
          id: `optimistic-${Date.now()}`,
          body,
          created_at: new Date().toISOString(),
          author: me,
        },
      })
      const res = await addComment(teamId, body)
      if (res?.error) setError(res.error)
    })
  }

  function onDelete(id: string) {
    setError(null)
    startTransition(async () => {
      apply({ type: 'remove', id })
      const res = await deleteComment(id, teamId)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <section id="comentarios" className="scroll-mt-32">
      <h2 className="mb-3 text-lg font-extrabold">
        Comentarios <span className="text-muted">({list.length})</span>
      </h2>

      <ul className="mb-4 flex flex-col gap-2.5">
        {list.length === 0 && (
          <li className="rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">
            Todavía no hay comentarios. ¡Sé el primero!
          </li>
        )}
        {list.map((c) => (
          <li key={c.id} className="flex gap-3 rounded-card border border-line bg-surface p-3">
            <Link href={`/u/${c.author.username}`} className="shrink-0">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-surface-2 text-muted">
                {c.author.avatar_url ? (
                  <Image src={c.author.avatar_url} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                ) : (
                  <User size={18} />
                )}
              </span>
            </Link>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2 text-sm">
                <Link href={`/u/${c.author.username}`} className="font-bold hover:text-brand">
                  @{c.author.username}
                </Link>
                <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
              </p>
              <p className="mt-0.5 break-words text-sm">{c.body}</p>
            </div>
            {c.author.id === me.id && !c.id.startsWith('optimistic') && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label="Eliminar comentario"
                title="Eliminar comentario"
                className="h-fit rounded-lg p-1.5 text-muted transition hover:bg-red-500 hover:text-white"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form ref={formRef} action={onSubmit} className="flex items-start gap-2">
        <textarea
          name="body"
          rows={2}
          maxLength={500}
          required
          placeholder="Escribe un comentario…"
          className="min-h-[46px] flex-1 resize-y rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-brand text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5 disabled:opacity-60"
          aria-label="Publicar comentario"
        >
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  )
}
