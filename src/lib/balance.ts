import type { Transaction } from '../types'

/** Ankerpunkt: Am Ende des Tages `date` betrug der Kontostand `amount` €. */
export interface BalanceAnchor {
  date: string // ISO YYYY-MM-DD
  amount: number
}

/**
 * Kontostand am Ende eines bestimmten Tages – bezogen auf den Anker.
 * Nutzt ALLE Buchungen (echtes Geld auf dem Konto, inkl. Umbuchungen).
 */
export function balanceAtEndOfDay(
  transactions: Transaction[],
  anchor: BalanceAnchor,
  iso: string,
): number {
  const A = anchor.date
  let sum = 0
  if (iso >= A) {
    for (const t of transactions) if (t.date > A && t.date <= iso) sum += t.amount
    return anchor.amount + sum
  }
  for (const t of transactions) if (t.date > iso && t.date <= A) sum += t.amount
  return anchor.amount - sum
}

/** Aktueller Kontostand = Anker + alle Buchungen nach dem Ankertag. */
export function currentBalance(
  transactions: Transaction[],
  anchor: BalanceAnchor,
): number {
  let sum = 0
  for (const t of transactions) if (t.date > anchor.date) sum += t.amount
  return anchor.amount + sum
}

/**
 * Kontostand NACH jeder einzelnen Buchung.
 * Deterministische Reihenfolge (Datum, dann createdAt, dann id), da die
 * bankinterne Reihenfolge innerhalb eines Tages nicht bekannt ist.
 * Rückgabe: Map von Buchungs-ID auf den Kontostand danach.
 */
export function runningBalances(
  transactions: Transaction[],
  anchor: BalanceAnchor,
): Map<string, number> {
  const sorted = [...transactions].sort(cmpAsc)
  const A = anchor.date
  let idxAfter = sorted.findIndex((t) => t.date > A)
  if (idxAfter === -1) idxAfter = sorted.length

  const result = new Map<string, number>()

  // Nach dem Anker: vorwärts aufaddieren.
  let running = anchor.amount
  for (let i = idxAfter; i < sorted.length; i++) {
    running += sorted[i].amount
    result.set(sorted[i].id, running)
  }

  // Am/vor dem Anker: rückwärts. Stand nach der letzten ≤Anker-Buchung = Anker.
  let suffix = 0
  for (let i = idxAfter - 1; i >= 0; i--) {
    result.set(sorted[i].id, anchor.amount - suffix)
    suffix += sorted[i].amount
  }
  return result
}

/** Monatsend-Kontostände für die angegebenen Monats-Schlüssel (YYYY-MM). */
export function monthlyEndBalances(
  transactions: Transaction[],
  anchor: BalanceAnchor,
  monthKeys: string[],
): { monthKey: string; balance: number }[] {
  return monthKeys.map((monthKey) => ({
    monthKey,
    balance: balanceAtEndOfDay(transactions, anchor, endOfMonthIso(monthKey)),
  }))
}

/** Letzter Tag eines Monats (YYYY-MM) als ISO-Datum. */
export function endOfMonthIso(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${monthKey}-${String(last).padStart(2, '0')}`
}

function cmpAsc(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
