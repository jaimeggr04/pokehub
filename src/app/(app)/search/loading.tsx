import { SearchTips } from '@/components/search/search-tips'
import {
  PopularCardSkeleton,
  SEARCH_GRID,
  SEARCH_MAIN,
  SEARCH_RAIL,
  SearchHeroSkeleton,
  TrainerListSkeleton,
} from '@/components/search/skeletons'

/**
 * Réplica de /search mientras llega la página desde otra sección. Entre
 * búsquedas no se ve: la página se queda y sólo sus resultados pasan a esqueleto.
 * El modo por defecto (y el de casi todos los enlaces) es entrenadores.
 */
export default function Loading() {
  return (
    <div className={SEARCH_GRID}>
      <div className={SEARCH_MAIN}>
        <SearchHeroSkeleton />
        <div className="mt-6">
          <TrainerListSkeleton label="Cargando la búsqueda…" />
        </div>
      </div>

      {/* Los trucos no dependen de datos: salen ya de verdad. */}
      <aside aria-label="Descubrir" className="hidden lg:block">
        <div className={SEARCH_RAIL}>
          <SearchTips />
          <PopularCardSkeleton />
        </div>
      </aside>
    </div>
  )
}
