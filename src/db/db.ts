import Dexie, { type Table } from 'dexie'
import type {
  Category,
  ImportPreset,
  Rule,
  Settings,
  Transaction,
} from '../types'
import { DEFAULT_CATEGORIES, defaultRules } from './seed'

/**
 * IndexedDB-Datenbank der App (lokal auf dem Gerät).
 * Alle Daten bleiben im Browser – es gibt keinen Server.
 */
export class AppDatabase extends Dexie {
  transactions!: Table<Transaction, string>
  categories!: Table<Category, string>
  rules!: Table<Rule, string>
  importPresets!: Table<ImportPreset, string>
  settings!: Table<Settings, string>

  constructor() {
    super('ausgabentracker')

    this.version(1).stores({
      // Indizierte Felder für schnelle Abfragen/Filter.
      transactions: 'id, date, categoryId, dedupHash, source, importBatchId',
      categories: 'id, order, kind',
      rules: 'id, categoryId',
      importPresets: 'id, name',
      settings: 'id',
    })
  }
}

export const db = new AppDatabase()

/** Eindeutige ID erzeugen (crypto.randomUUID mit Fallback). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Legt beim ersten Start Standardkategorien und Einstellungen an.
 * Idempotent: mehrfacher Aufruf schadet nicht.
 */
export async function ensureSeeded(): Promise<void> {
  const catCount = await db.categories.count()
  if (catCount === 0) {
    // Frische Installation: Kategorien und Standard-Regeln anlegen.
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    const rulesCount = await db.rules.count()
    if (rulesCount === 0) {
      await db.rules.bulkAdd(defaultRules(new Date().toISOString()))
    }
  } else {
    // Bestehende Installationen: nachträglich ergänzte Standards migrieren.
    await runMigrations()
  }

  const settings = await db.settings.get('app')
  if (!settings) {
    await db.settings.put({ id: 'app', currency: 'EUR', theme: 'system' })
  }
}

// IDs von Standardkategorien, die nach dem ersten Release ergänzt wurden.
// Werden bei bestehenden Installationen einmalig nachgezogen (nur falls fehlend).
const LATER_ADDED_CATEGORY_IDS = [
  'cat-gluecksspiel',
  'cat-umbuchung',
  'cat-erstattung',
  'cat-private-einnahme',
  'cat-shop-kleidung',
  'cat-shop-technik',
  'cat-shop-krimskrams',
  'cat-rest-privat',
  'cat-rest-beruflich',
]

/**
 * Sanfte Migrationen für bestehende Installationen.
 * Fügt neue Standardkategorien hinzu (falls nicht vorhanden) und hängt die
 * ursprüngliche Lotto-Regel von „Freizeit" auf „Glücksspiel" um.
 */
async function runMigrations(): Promise<void> {
  for (const id of LATER_ADDED_CATEGORY_IDS) {
    const exists = await db.categories.get(id)
    if (!exists) {
      const def = DEFAULT_CATEGORIES.find((c) => c.id === id)
      if (def) await db.categories.add(def)
    }
  }

  // Frühere Regel „lotto → Freizeit" auf Glücksspiel umstellen …
  const freizeitLotto = await db.rules
    .filter((r) => r.pattern === 'lotto' && r.categoryId === 'cat-freizeit')
    .toArray()
  for (const r of freizeitLotto) {
    await db.rules.update(r.id, { categoryId: 'cat-gluecksspiel' })
  }

  // … und sicherstellen, dass überhaupt eine Lotto→Glücksspiel-Regel existiert.
  const anyLotto = await db.rules.filter((r) => r.pattern === 'lotto').count()
  if (anyLotto === 0) {
    await db.rules.add({
      id: newId(),
      field: 'any',
      pattern: 'lotto',
      categoryId: 'cat-gluecksspiel',
      createdAt: new Date().toISOString(),
    })
  }

  // Standardname „Einkommen" → „Gehalt & Lohn" (nur falls unverändert).
  const einkommen = await db.categories.get('cat-einkommen')
  if (einkommen && einkommen.name === 'Einkommen') {
    await db.categories.update('cat-einkommen', { name: 'Gehalt & Lohn' })
  }
}

/** Löscht sämtliche Nutzerdaten und stellt die Standardkategorien wieder her. */
export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.categories, db.rules, db.importPresets, db.settings],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.rules.clear(),
        db.importPresets.clear(),
        db.settings.clear(),
      ])
    },
  )
  await ensureSeeded()
}
