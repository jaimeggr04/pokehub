/**
 * Se vuelve a montar en cada navegación: la página entra con un fundido corto.
 * Sólo opacidad a propósito (ver .shell-page): un transform aquí rompería los
 * elementos position: fixed de las páginas.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="shell-page">{children}</div>
}
