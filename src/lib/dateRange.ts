// Helfer zum Berechnen von Zeitraum-Grenzen (ISO YYYY-MM-DD).

export type RangePreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear' | 'all'

export interface DateRange {
  from: string
  to: string
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Liefert die ISO-Grenzen für einen benannten Zeitraum (bezogen auf heute). */
export function rangeForPreset(preset: RangePreset, today = new Date()): DateRange {
  const y = today.getFullYear()
  const m = today.getMonth()

  switch (preset) {
    case 'thisMonth':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
    case 'lastMonth':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case 'last3Months':
      return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) }
    case 'thisYear':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) }
    case 'all':
    default:
      return { from: '0000-01-01', to: '9999-12-31' }
  }
}

export const RANGE_LABELS: Record<RangePreset, string> = {
  thisMonth: 'Dieser Monat',
  lastMonth: 'Letzter Monat',
  last3Months: 'Letzte 3 Monate',
  thisYear: 'Dieses Jahr',
  all: 'Gesamt',
}

/** Heutiges Datum als ISO (für Formular-Vorbelegung). */
export function todayIso(): string {
  return iso(new Date())
}
