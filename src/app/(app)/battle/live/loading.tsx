import { BoardSkeleton } from '@/components/battle/board/board-skeleton'

/** Mismo tablero que page.tsx mientras se lee el equipo en el servidor. */
export default function Loading() {
  return <BoardSkeleton label="Preparando la partida…" />
}
