import type { Category, Rule } from '../types'

/**
 * Standardkategorien, die beim ersten Start angelegt werden.
 * Farben sind bewusst gut unterscheidbar (Chart-tauglich).
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-lebensmittel', name: 'Lebensmittel', emoji: '🛒', color: '#22c55e', kind: 'expense', isDefault: true, order: 1 },
  { id: 'cat-wohnen', name: 'Wohnen & Nebenkosten', emoji: '🏠', color: '#3b82f6', kind: 'expense', isDefault: true, order: 2 },
  { id: 'cat-mobilitaet', name: 'Mobilität', emoji: '🚗', color: '#f97316', kind: 'expense', isDefault: true, order: 3 },
  { id: 'cat-freizeit', name: 'Freizeit & Ausgehen', emoji: '🎉', color: '#a855f7', kind: 'expense', isDefault: true, order: 4 },
  { id: 'cat-gluecksspiel', name: 'Glücksspiel', emoji: '🎰', color: '#d97706', kind: 'expense', isDefault: true, order: 5 },
  { id: 'cat-gesundheit', name: 'Gesundheit', emoji: '💊', color: '#ef4444', kind: 'expense', isDefault: true, order: 6 },
  { id: 'cat-shopping', name: 'Shopping', emoji: '🛍️', color: '#ec4899', kind: 'expense', isDefault: true, order: 6 },
  { id: 'cat-abos', name: 'Abos & Verträge', emoji: '🔁', color: '#14b8a6', kind: 'expense', isDefault: true, order: 7 },
  { id: 'cat-restaurant', name: 'Restaurant & Café', emoji: '🍽️', color: '#eab308', kind: 'expense', isDefault: true, order: 8 },
  { id: 'cat-reisen', name: 'Reisen', emoji: '✈️', color: '#06b6d4', kind: 'expense', isDefault: true, order: 9 },
  { id: 'cat-bildung', name: 'Bildung', emoji: '📚', color: '#6366f1', kind: 'expense', isDefault: true, order: 10 },
  { id: 'cat-versicherung', name: 'Versicherung & Finanzen', emoji: '🛡️', color: '#64748b', kind: 'expense', isDefault: true, order: 11 },
  { id: 'cat-einkommen', name: 'Einkommen', emoji: '💰', color: '#16a34a', kind: 'income', isDefault: true, order: 12 },
  { id: 'cat-sonstiges', name: 'Sonstiges', emoji: '❓', color: '#94a3b8', kind: 'both', isDefault: true, order: 99 },
]

/** Farbe für nicht kategorisierte Buchungen in Charts. */
export const UNCATEGORIZED_COLOR = '#cbd5e1'

/**
 * Standard-Regeln für die Auto-Kategorisierung beim ersten Start.
 * Greifen auf Verwendungszweck ODER Empfänger (field: 'any').
 * Nutzer können sie unter „Mehr → Regeln" jederzeit anpassen oder löschen.
 */
const RULE_SEED: { pattern: string; categoryId: string }[] = [
  // Spezifische Regeln zuerst (erste passende Regel gewinnt)
  { pattern: 'aldi talk', categoryId: 'cat-abos' },
  // Lebensmittel
  { pattern: 'rewe', categoryId: 'cat-lebensmittel' },
  { pattern: 'edeka', categoryId: 'cat-lebensmittel' },
  { pattern: 'aldi', categoryId: 'cat-lebensmittel' },
  { pattern: 'lidl', categoryId: 'cat-lebensmittel' },
  { pattern: 'kaufland', categoryId: 'cat-lebensmittel' },
  { pattern: 'penny', categoryId: 'cat-lebensmittel' },
  { pattern: 'netto', categoryId: 'cat-lebensmittel' },
  { pattern: 'dm ', categoryId: 'cat-lebensmittel' },
  // Mobilität
  { pattern: 'aral', categoryId: 'cat-mobilitaet' },
  { pattern: 'shell', categoryId: 'cat-mobilitaet' },
  { pattern: 'esso', categoryId: 'cat-mobilitaet' },
  { pattern: 'tankstelle', categoryId: 'cat-mobilitaet' },
  { pattern: 'deutsche bahn', categoryId: 'cat-mobilitaet' },
  { pattern: 'db bahn', categoryId: 'cat-mobilitaet' },
  { pattern: 'bahn ticket', categoryId: 'cat-mobilitaet' },
  { pattern: 'uber', categoryId: 'cat-mobilitaet' },
  // Wohnen
  { pattern: 'miete', categoryId: 'cat-wohnen' },
  { pattern: 'stadtwerke', categoryId: 'cat-wohnen' },
  { pattern: 'strom', categoryId: 'cat-wohnen' },
  // Abos
  { pattern: 'netflix', categoryId: 'cat-abos' },
  { pattern: 'spotify', categoryId: 'cat-abos' },
  { pattern: 'disney', categoryId: 'cat-abos' },
  { pattern: 'amazon prime', categoryId: 'cat-abos' },
  { pattern: 'vodafone', categoryId: 'cat-abos' },
  { pattern: 'telekom', categoryId: 'cat-abos' },
  // Shopping
  { pattern: 'amazon', categoryId: 'cat-shopping' },
  { pattern: 'zalando', categoryId: 'cat-shopping' },
  { pattern: 'hennes', categoryId: 'cat-shopping' },
  { pattern: 'h & m', categoryId: 'cat-shopping' },
  { pattern: 'ikea', categoryId: 'cat-shopping' },
  { pattern: 'mediamarkt', categoryId: 'cat-shopping' },
  // Gesundheit
  { pattern: 'apotheke', categoryId: 'cat-gesundheit' },
  { pattern: 'mcfit', categoryId: 'cat-gesundheit' },
  { pattern: 'fitness', categoryId: 'cat-gesundheit' },
  // Restaurant / Café
  { pattern: 'restaurant', categoryId: 'cat-restaurant' },
  { pattern: 'mcdonald', categoryId: 'cat-restaurant' },
  { pattern: 'starbucks', categoryId: 'cat-restaurant' },
  { pattern: 'lieferando', categoryId: 'cat-restaurant' },
  { pattern: 'caffe', categoryId: 'cat-restaurant' },
  { pattern: 'too good to go', categoryId: 'cat-restaurant' },
  // Glücksspiel
  { pattern: 'lotto', categoryId: 'cat-gluecksspiel' },
  { pattern: 'tipico', categoryId: 'cat-gluecksspiel' },
  { pattern: 'oddset', categoryId: 'cat-gluecksspiel' },
  { pattern: 'bwin', categoryId: 'cat-gluecksspiel' },
  { pattern: 'casino', categoryId: 'cat-gluecksspiel' },
  { pattern: 'spielbank', categoryId: 'cat-gluecksspiel' },
  { pattern: 'eurojackpot', categoryId: 'cat-gluecksspiel' },
  // Freizeit
  { pattern: 'kino', categoryId: 'cat-freizeit' },
  { pattern: 'cinema', categoryId: 'cat-freizeit' },
  { pattern: 'europa park', categoryId: 'cat-freizeit' },
  // Shopping
  { pattern: 'temu', categoryId: 'cat-shopping' },
  // Versicherung & Finanzen
  { pattern: 'versicherung', categoryId: 'cat-versicherung' },
  { pattern: 'lebensversicher', categoryId: 'cat-versicherung' },
  { pattern: 'baloise', categoryId: 'cat-versicherung' },
  { pattern: 'scalable', categoryId: 'cat-versicherung' },
  { pattern: 'sparplan', categoryId: 'cat-versicherung' },
  { pattern: 'darl.-leistung', categoryId: 'cat-versicherung' },
  { pattern: 'kreditkartenabrechnung', categoryId: 'cat-versicherung' },
  // Einkommen
  { pattern: 'gehalt', categoryId: 'cat-einkommen' },
  { pattern: 'lohn', categoryId: 'cat-einkommen' },
]

/** Erzeugt die Standard-Regeln mit stabilen IDs und Zeitstempel. */
export function defaultRules(createdAt: string): Rule[] {
  return RULE_SEED.map((r, i) => ({
    id: `rule-seed-${i}`,
    field: 'any',
    pattern: r.pattern,
    categoryId: r.categoryId,
    createdAt,
  }))
}
