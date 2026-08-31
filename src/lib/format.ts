const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 45) return 'ahora'
  for (const [unit, secs] of UNITS) {
    if (seconds >= secs) return rtf.format(-Math.floor(seconds / secs), unit)
  }
  return 'ahora'
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
