import type { Transaction } from '../types'

/**
 * Erzeugt einen stabilen Hash zur Duplikat-Erkennung.
 * Basis: Datum + Betrag (auf Cent) + normalisierter Zweck + Empfänger.
 * So werden beim erneuten Import derselben Buchungen keine Doppel angelegt.
 */
export function makeDedupHash(input: {
  date: string
  amount: number
  description: string
  counterparty: string
}): string {
  const normalize = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  const cents = Math.round(input.amount * 100)
  const key = [
    input.date,
    cents,
    normalize(input.description),
    normalize(input.counterparty),
  ].join('|')

  return hashString(key)
}

/** Kleiner, schneller String-Hash (djb2), als Hex-String. */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  // In vorzeichenlose 32-Bit-Zahl umwandeln.
  return (hash >>> 0).toString(16)
}

/**
 * Filtert Buchungen, deren Hash bereits in `existingHashes` vorkommt
 * oder die innerhalb des Imports doppelt sind.
 */
export function splitDuplicates<T extends Pick<Transaction, 'dedupHash'>>(
  candidates: T[],
  existingHashes: Set<string>,
): { fresh: T[]; duplicates: T[] } {
  const seen = new Set(existingHashes)
  const fresh: T[] = []
  const duplicates: T[] = []
  for (const c of candidates) {
    if (seen.has(c.dedupHash)) {
      duplicates.push(c)
    } else {
      seen.add(c.dedupHash)
      fresh.push(c)
    }
  }
  return { fresh, duplicates }
}
