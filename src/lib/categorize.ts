import type { Rule, Transaction } from '../types'

/**
 * Wendet Auto-Kategorisierungs-Regeln auf eine Buchung an und liefert die
 * erste passende Kategorie-ID zurück (oder null, wenn keine Regel greift).
 */
export function categorizeByRules(
  tx: Pick<Transaction, 'description' | 'counterparty'>,
  rules: Rule[],
): string | null {
  const desc = (tx.description || '').toLowerCase()
  const cp = (tx.counterparty || '').toLowerCase()

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase().trim()
    if (!pattern) continue

    const haystack =
      rule.field === 'description'
        ? desc
        : rule.field === 'counterparty'
          ? cp
          : desc + ' ' + cp

    if (haystack.includes(pattern)) {
      return rule.categoryId
    }
  }
  return null
}
