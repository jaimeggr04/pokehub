export default function Loading() {
  return (
    <div className="mx-auto max-w-[1700px] px-3 sm:px-4">
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
    </div>
  )
}
