import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export const uid = (prefix = 'id'): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const round = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export const formatDate = (iso: string, timezone?: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(date)
}

export const formatDateTime = (iso: string, timezone?: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date)
}

export const formatTime = (iso: string, timezone?: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date)
}

export const formatWeekday = (iso: string, timezone?: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: timezone }).format(date)
}

export const formatRelative = (iso: string, now = new Date()): string => {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return '—'
  const diffMs = target - now.getTime()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600_000],
    ['month', 30 * 24 * 3600_000],
    ['week', 7 * 24 * 3600_000],
    ['day', 24 * 3600_000],
    ['hour', 3600_000],
    ['minute', 60_000],
  ]
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }
  return rtf.format(Math.round(diffMs / 60_000), 'minute')
}

export const formatMinutes = (minutes: number | null): string => {
  if (minutes === null || Number.isNaN(minutes)) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export const toDateInputValue = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export const todayInputValue = (): string => new Date().toISOString().slice(0, 10)

export const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length

export const percentChange = (from: number | null, to: number | null): number | null => {
  if (from === null || to === null || from === 0) return null
  return ((to - from) / Math.abs(from)) * 100
}

export const uniqueBy = <T, K>(items: T[], key: (item: T) => K): T[] => {
  const seen = new Set<K>()
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const groupBy = <T, K extends string>(items: T[], key: (item: T) => K) =>
  items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item)
      ;(acc[k] ??= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )

export const sortByDescending = <T>(items: T[], key: (item: T) => string): T[] =>
  [...items].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0))

export const sortByAscending = <T>(items: T[], key: (item: T) => string): T[] =>
  [...items].sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0))
