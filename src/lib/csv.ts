import Papa from 'papaparse'
import type { AmountMode, DecimalSeparator } from '../types'

export type Encoding = 'utf-8' | 'iso-8859-1' | 'windows-1252'

/** Liest eine Datei als Text mit dem angegebenen Encoding. */
export async function readFileWithEncoding(
  file: File,
  encoding: Encoding,
): Promise<string> {
  const buffer = await file.arrayBuffer()
  return new TextDecoder(encoding).decode(buffer)
}

/**
 * Rät das Encoding: Wenn UTF-8-Dekodierung Ersatzzeichen (�) erzeugt,
 * ist es vermutlich Windows-1252 (verbreitet bei deutschen Bank-CSVs).
 */
export async function detectEncoding(file: File): Promise<Encoding> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (utf8.includes('�')) return 'windows-1252'
  return 'utf-8'
}

/** Rät das Spaltentrennzeichen anhand der ersten Zeilen. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n')
  const candidates = [';', ',', '\t', '|']
  let best = ';'
  let bestCount = -1
  for (const d of candidates) {
    const count = sample.split(d).length - 1
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

/** Parst rohen CSV-Text in eine Matrix aus Strings (ohne Header-Logik). */
export function parseRaw(text: string, delimiter: string): string[][] {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: 'greedy',
  })
  return (result.data || []).filter((row) => row.length > 0)
}

// Typische Wörter in einer Kontoauszug-Kopfzeile.
const HEADER_KEYWORDS = [
  /buchung/,
  /datum/,
  /wertstellung/,
  /valuta/,
  /betrag/,
  /umsatz/,
  /verwendungszweck/,
  /empf/,
  /auftraggeber/,
  /iban/,
  /soll/,
  /haben/,
  /waehrung|währung/,
]

/**
 * Findet die Zeile, die am ehesten die Tabellen-Kopfzeile ist.
 * Viele Banken (z. B. DKB, Sparkasse) stellen der Tabelle mehrere
 * Info-/Leerzeilen voran – diese werden so automatisch übersprungen.
 * Gibt den Zeilenindex zurück (0, wenn keine eindeutige Kopfzeile gefunden).
 */
export function detectHeaderRow(rows: string[][]): number {
  let bestIdx = 0
  let bestScore = 0
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map((c) => (c || '').toLowerCase())
    let score = 0
    for (const cell of cells) {
      if (HEADER_KEYWORDS.some((k) => k.test(cell))) score++
    }
    // Erste Zeile mit der höchsten Trefferzahl gewinnt.
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  // Nur akzeptieren, wenn mindestens zwei Kopf-Begriffe gefunden wurden.
  return bestScore >= 2 ? bestIdx : 0
}

/**
 * Wandelt einen Betrags-String in eine Zahl um.
 * Behandelt Tausendertrennzeichen, Dezimalkomma/-punkt, führendes und
 * nachgestelltes Minus sowie Währungssymbole.
 */
export function parseAmount(
  raw: string,
  decimalSeparator: DecimalSeparator,
): number {
  if (raw == null) return NaN
  let s = String(raw).trim()
  if (s === '') return NaN

  // Negativ, wenn Minus vorne/hinten oder in Klammern steht.
  const negative = /-/.test(s) || /^\(.*\)$/.test(s)

  // Nur Ziffern und Trennzeichen behalten.
  s = s.replace(/[^0-9.,]/g, '')
  if (s === '') return NaN

  if (decimalSeparator === ',') {
    // Punkte sind Tausendertrennzeichen, Komma ist Dezimaltrenner.
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    // Kommas sind Tausendertrennzeichen.
    s = s.replace(/,/g, '')
  }

  const value = parseFloat(s)
  if (isNaN(value)) return NaN
  return negative ? -Math.abs(value) : value
}

/** Rät das Dezimaltrennzeichen anhand mehrerer Betrags-Beispiele. */
export function guessDecimalSeparator(samples: string[]): DecimalSeparator {
  for (const raw of samples) {
    const s = String(raw ?? '')
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma >= 0 || lastDot >= 0) {
      return lastComma > lastDot ? ',' : '.'
    }
  }
  return ',' // deutscher Standard
}

const DATE_PATTERNS: { re: RegExp; format: string }[] = [
  { re: /^\d{4}-\d{2}-\d{2}/, format: 'YYYY-MM-DD' },
  { re: /^\d{1,2}\.\d{1,2}\.\d{4}/, format: 'DD.MM.YYYY' },
  { re: /^\d{1,2}\.\d{1,2}\.\d{2}(\D|$)/, format: 'DD.MM.YY' },
  { re: /^\d{1,2}\/\d{1,2}\/\d{4}/, format: 'DD/MM/YYYY' },
]

/** Rät das Datumsformat anhand eines Beispielwerts. */
export function guessDateFormat(sample: string): string {
  const s = String(sample ?? '').trim()
  for (const p of DATE_PATTERNS) {
    if (p.re.test(s)) return p.format
  }
  return 'DD.MM.YYYY'
}

/**
 * Parst einen Datums-String gemäß Format in ISO (YYYY-MM-DD).
 * Gibt null zurück, wenn das Datum ungültig ist.
 */
export function parseDate(raw: string, format: string): string | null {
  const s = String(raw ?? '').trim()
  const nums = s.match(/\d+/g)
  if (!nums || nums.length < 3) return null

  // Positionen der Tokens im Format bestimmen.
  const yPos = format.indexOf('Y')
  const mPos = format.indexOf('M')
  const dPos = format.indexOf('D')

  const tokens = [
    { key: 'Y', pos: yPos },
    { key: 'M', pos: mPos },
    { key: 'D', pos: dPos },
  ]
    .filter((t) => t.pos >= 0)
    .sort((a, b) => a.pos - b.pos)

  if (tokens.length < 3) return null

  const values: Record<string, number> = {}
  tokens.forEach((t, i) => {
    values[t.key] = Number(nums[i])
  })

  let year = values.Y
  const month = values.M
  const day = values.D
  if (year < 100) year += year < 70 ? 2000 : 1900

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`
  // Plausibilitätsprüfung.
  const check = new Date(year, month - 1, day)
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null
  }
  return iso
}

/** Rät eine Spaltenzuordnung anhand der Header-Namen. */
export function guessColumns(headers: string[]): {
  amountMode: AmountMode
  date: string
  amount?: string
  debit?: string
  credit?: string
  description?: string
  counterparty?: string
} {
  const norm = (h: string) => h.toLowerCase().trim()
  // Muster-Priorität: frühere Muster gewinnen (unabhängig von der Spaltenreihenfolge).
  const find = (patterns: RegExp[]) => {
    for (const p of patterns) {
      const match = headers.find((h) => p.test(norm(h)))
      if (match) return match
    }
    return undefined
  }

  const date =
    find([/buchungstag/, /buchungsdatum/, /^datum/, /wertstellung/, /valuta/, /date/]) ??
    headers[0] ??
    ''

  const debit = find([/^soll/, /belastung/, /abgang/])
  const credit = find([/^haben/, /gutschrift/, /eingang/])

  const amount = find([
    /^betrag/,
    /umsatz/,
    /amount/,
    /^wert$/,
    /buchungsbetrag/,
  ])

  const description = find([
    /verwendungszweck/,
    /buchungstext/,
    /beschreibung/,
    /vorgang/,
    /zweck/,
    /umsatzart/,
    /description/,
    /text/,
  ])

  const counterparty = find([
    /empf/,
    /auftraggeber/,
    /beg(ü|ue)nstigter/,
    /pflichtiger/,
    /zahlungsempf/,
    /gegenkonto/,
    /beneficiary/,
    /payee/,
    /kontoinhaber/,
    /name/,
  ])

  const amountMode: AmountMode = debit && credit && !amount ? 'debitCredit' : 'single'

  return {
    amountMode,
    date,
    amount,
    debit,
    credit,
    description,
    counterparty,
  }
}
