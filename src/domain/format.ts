const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 })

export function formatKES(amount: number): string {
  return `KES ${kes.format(amount)}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(n)
}

/** 1,284 / 12.9K / 1.2M — for stat tiles where space is tight. */
export function compactKES(amount: number): string {
  if (Math.abs(amount) < 10_000) return formatKES(amount)
  return `KES ${new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })
}

/** "Just now", "12m", "3h", "Yesterday", "4 Oct" — for inbox and activity lists. */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (isSameDay(new Date(iso), now)) return `${Math.floor(diff / 3600)}h`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(new Date(iso), yesterday)) return 'Yesterday'
  return formatDate(iso)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
