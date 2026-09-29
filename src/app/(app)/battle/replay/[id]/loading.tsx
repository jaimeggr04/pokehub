import { BoardSkeleton } from '@/components/battle/board/board-skeleton'

/** Tablero con la barra de turnos abajo, como la repetición ya cargada. */
export default function Loading() {
  return <BoardSkeleton label="Cargando la repetición…" withDock />
}
