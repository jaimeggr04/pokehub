'use client'

import Image from 'next/image'
import { Plus } from 'lucide-react'
import clsx from 'clsx'
import { BuildMeter } from '@/components/builder/fields'
import { MAX_SLOTS, buildProgress, slotIssues, slotName, type Slot } from '@/components/builder/model'
import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { spriteUrl } from '@/lib/pokemon'

/**
 * Los seis huecos de un vistazo, como la pantalla de equipo de los juegos:
 * sprite, barra de "PS" con lo que le falta a cada build y un punto si tiene
 * algún aviso. Pulsar un hueco lleva a su editor; uno libre añade un Pokémon.
 */
export function TeamPanel({
  slots,
  openKey,
  rolling,
  duplicates,
  onSelect,
  onAdd,
  children,
}: {
  slots: Slot[]
  openKey: string | null
  /** Posiciones que «Sorpréndeme» está generando ahora mismo. */
  rolling: ReadonlySet<number>
  duplicates: ReadonlySet<number>
  onSelect: (key: string) => void
  onAdd: () => void
  /** Pie del panel (el análisis de tipos). */
  children?: React.ReactNode
}) {
  const filled = slots.filter((s) => s.pokemon_id > 0)
  // Sobre seis huecos, no sobre los que haya: un equipo de tres completo está a medias.
  const done = filled.reduce((acc, s) => acc + buildProgress(s).done, 0)
  const percent = Math.round((done / (MAX_SLOTS * 8)) * 100)

  return (
    <section aria-labelledby="builder-party-title" className="card p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 id="builder-party-title" className="text-base font-extrabold">
          Tu equipo
        </h2>
        <span className="text-xs font-bold tabular-nums text-muted">
          {filled.length}/{MAX_SLOTS}
          <span className="sr-only"> Pokémon</span>
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2.5">
        <span
          role="progressbar"
          aria-label="Equipo completado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent} %`}
          className="builder-hp builder-team-meter h-1.5 flex-1"
        >
          <span style={{ '--hp': percent / 100 } as React.CSSProperties} />
        </span>
        <span aria-hidden className="text-xs font-semibold tabular-nums text-muted">
          {percent} %
        </span>
      </div>

      <ol className="grid grid-cols-6 gap-1.5 sm:gap-2 lg:grid-cols-3 lg:gap-2.5">
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const slot = slots[i]
          const isRolling = rolling.has(i)
          if (!slot || !slot.pokemon_id) {
            return (
              <li key={slot?.key ?? `free-${i}`}>
                <button
                  type="button"
                  data-empty=""
                  aria-current={slot && slot.key === openKey ? 'true' : undefined}
                  aria-label={isRolling ? `Hueco ${i + 1}: generando…` : `Hueco ${i + 1} libre: añadir Pokémon`}
                  onClick={() => (slot ? onSelect(slot.key) : onAdd())}
                  className="builder-party-slot"
                >
                  <span className="builder-party-stage">
                    {isRolling ? (
                      <PokeballSpinner size={22} label="Generando Pokémon…" />
                    ) : (
                      <Plus size={18} strokeWidth={2.6} aria-hidden />
                    )}
                  </span>
                  <span aria-hidden className="hidden truncate text-center text-[11px] font-semibold lg:block">
                    Hueco {i + 1}
                  </span>
                  <span aria-hidden className="builder-hp opacity-0" />
                </button>
              </li>
            )
          }

          const progress = buildProgress(slot)
          const issues = slotIssues(slot, duplicates.has(i))
          const worst = issues.find((x) => x.tone === 'danger') ?? issues[0]
          const name = slotName(slot, i)
          const status = progress.missing.length ? `falta ${progress.missing.join(', ')}` : 'build completo'

          return (
            <li key={slot.key}>
              <button
                type="button"
                aria-current={slot.key === openKey ? 'true' : undefined}
                aria-label={`${i + 1}. ${name}: ${status}${issues.length ? `. ${issues.map((x) => x.label).join(', ')}` : ''}`}
                title={name}
                onClick={() => onSelect(slot.key)}
                className="builder-party-slot"
              >
                <span className="builder-party-stage">
                  <Image
                    key={`${slot.pokemon_id}-${slot.shiny}`}
                    src={spriteUrl(slot.pokemon_id, slot.shiny)}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                    style={{ '--s': i } as React.CSSProperties}
                    className={clsx('builder-party-sprite builder-sprite-in', isRolling && 'opacity-30')}
                  />
                  {isRolling && (
                    <span className="absolute inset-0 grid place-items-center">
                      <PokeballSpinner size={22} label="Generando Pokémon…" />
                    </span>
                  )}
                  {worst && !isRolling && (
                    <span
                      aria-hidden
                      className={clsx('builder-party-dot', worst.tone === 'danger' ? 'bg-danger' : 'bg-warning')}
                    />
                  )}
                </span>
                <span aria-hidden className="hidden truncate text-center text-[11px] font-semibold lg:block">
                  {name}
                </span>
                <BuildMeter done={progress.done} total={progress.total} className="mx-0.5" />
              </button>
            </li>
          )
        })}
      </ol>

      {children}
    </section>
  )
}
