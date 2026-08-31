'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2, Search, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Result {
  id: string
  username: string
  display_name: string | null
  bio: string
  avatar_url: string | null
  team_count: number
}

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    const id = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc('search_profiles', { q: term, limit_count: 6 })
      setResults((data as Result[] | null) ?? [])
      setLoading(false)
      setOpen(true)
    }, 280)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={boxRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && setOpen(true)}
          autoFocus={autoFocus}
          type="search"
          placeholder="Buscar entrenadores…"
          aria-label="Buscar entrenadores"
          className="h-11 w-full rounded-full border border-line bg-surface-2 pl-4 pr-11 text-sm outline-none transition placeholder:text-muted focus:border-brand"
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
        </span>
      </form>

      {open && results && (
        <ul className="animate-fade-up absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-80 overflow-auto rounded-xl border border-line bg-bg-elevated p-1.5 shadow-float">
          {results.length === 0 && (
            <li className="px-3 py-3 text-center text-sm text-muted">Sin resultados para «{q}».</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={`/u/${r.username}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-surface"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-line text-muted">
                  {r.avatar_url ? (
                    <Image src={r.avatar_url} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <User size={16} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">@{r.username}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.team_count} equipo{r.team_count === 1 ? '' : 's'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
