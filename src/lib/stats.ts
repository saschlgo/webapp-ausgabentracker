import type { Transaction } from '../types'
import { monthKeyOf } from './format'

export interface Summary {
  expenses: number // positiver Betrag der Ausgaben
  income: number // positiver Betrag der Einnahmen
  balance: number // income - expenses
  count: number
}

/** Buchungen auf einen Datumsbereich (inklusive) eingrenzen. */
export function filterByRange(
  transactions: Transaction[],
  fromIso: string,
  toIso: string,
): Transaction[] {
  return transactions.filter((t) => t.date >= fromIso && t.date <= toIso)
}

/** Summiert Ausgaben, Einnahmen und Saldo. */
export function computeSummary(transactions: Transaction[]): Summary {
  let expenses = 0
  let income = 0
  for (const t of transactions) {
    if (t.amount < 0) expenses += -t.amount
    else income += t.amount
  }
  return {
    expenses,
    income,
    balance: income - expenses,
    count: transactions.length,
  }
}

export interface CategoryTotal {
  categoryId: string | null
  total: number // positiver Ausgaben-Betrag
}

/** Ausgaben je Kategorie (nur negative Buchungen), absteigend sortiert. */
export function expensesByCategory(transactions: Transaction[]): CategoryTotal[] {
  const map = new Map<string | null, number>()
  for (const t of transactions) {
    if (t.amount >= 0) continue
    const key = t.categoryId ?? null
    map.set(key, (map.get(key) ?? 0) + -t.amount)
  }
  return Array.from(map.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total)
}

export interface MonthlyTotal {
  monthKey: string // YYYY-MM
  expenses: number
  income: number
}

/** Ausgaben und Einnahmen pro Monat, chronologisch sortiert. */
export function monthlyTotals(transactions: Transaction[]): MonthlyTotal[] {
  const map = new Map<string, MonthlyTotal>()
  for (const t of transactions) {
    const key = monthKeyOf(t.date)
    let entry = map.get(key)
    if (!entry) {
      entry = { monthKey: key, expenses: 0, income: 0 }
      map.set(key, entry)
    }
    if (t.amount < 0) entry.expenses += -t.amount
    else entry.income += t.amount
  }
  return Array.from(map.values()).sort((a, b) =>
    a.monthKey < b.monthKey ? -1 : 1,
  )
}

/** Die größten Einzelausgaben (nach Betrag). */
export function topExpenses(
  transactions: Transaction[],
  limit = 5,
): Transaction[] {
  return transactions
    .filter((t) => t.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, limit)
}
