// Formatierungs-Helfer im deutschen Format (de-DE).

const currencyFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const currencyNoDecimalsFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Betrag als Euro-Währung, z. B. -12,50 €. */
export function formatCurrency(value: number): string {
  return currencyFmt.format(value)
}

/** Betrag ohne Nachkommastellen (für kompakte Achsen). */
export function formatCurrencyShort(value: number): string {
  return currencyNoDecimalsFmt.format(value)
}

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateShortFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
})

const monthLabelFmt = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
})

const monthShortFmt = new Intl.DateTimeFormat('de-DE', {
  month: 'short',
  year: '2-digit',
})

/** ISO-Datum (YYYY-MM-DD) → 16.07.2026 */
export function formatDate(iso: string): string {
  const d = parseIsoDate(iso)
  return d ? dateFmt.format(d) : iso
}

/** ISO-Datum → 16.07. */
export function formatDateShort(iso: string): string {
  const d = parseIsoDate(iso)
  return d ? dateShortFmt.format(d) : iso
}

/** Monats-Schlüssel (YYYY-MM) → "Juli 2026" */
export function formatMonthLabel(monthKey: string): string {
  const d = parseIsoDate(monthKey + '-01')
  return d ? monthLabelFmt.format(d) : monthKey
}

/** Monats-Schlüssel (YYYY-MM) → "Jul 26" */
export function formatMonthShort(monthKey: string): string {
  const d = parseIsoDate(monthKey + '-01')
  return d ? monthShortFmt.format(d) : monthKey
}

/** Robustes Parsen eines ISO-Datums als lokale Zeit (kein UTC-Versatz). */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

/** YYYY-MM eines ISO-Datums. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}
