import { db, ensureSeeded } from '../db/db'
import type {
  Category,
  ImportPreset,
  Rule,
  Settings,
  Transaction,
} from '../types'

interface BackupFile {
  app: 'ausgabentracker'
  version: number
  exportedAt: string
  data: {
    transactions: Transaction[]
    categories: Category[]
    rules: Rule[]
    importPresets: ImportPreset[]
    settings: Settings[]
  }
}

/** Erstellt ein vollständiges Backup als herunterladbare JSON-Datei. */
export async function exportBackup(): Promise<void> {
  const [transactions, categories, rules, importPresets, settings] =
    await Promise.all([
      db.transactions.toArray(),
      db.categories.toArray(),
      db.rules.toArray(),
      db.importPresets.toArray(),
      db.settings.toArray(),
    ])

  const backup: BackupFile = {
    app: 'ausgabentracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { transactions, categories, rules, importPresets, settings },
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = backup.exportedAt.slice(0, 10)
  a.href = url
  a.download = `ausgabentracker-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Importiert ein Backup. Ersetzt den kompletten Datenbestand.
 * Gibt die Anzahl der importierten Buchungen zurück.
 */
export async function importBackup(file: File): Promise<number> {
  const text = await file.text()
  const parsed = JSON.parse(text) as BackupFile

  if (parsed.app !== 'ausgabentracker' || !parsed.data) {
    throw new Error('Ungültige Backup-Datei.')
  }

  const { transactions, categories, rules, importPresets, settings } =
    parsed.data

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
      await Promise.all([
        db.transactions.bulkAdd(transactions ?? []),
        db.categories.bulkAdd(categories ?? []),
        db.rules.bulkAdd(rules ?? []),
        db.importPresets.bulkAdd(importPresets ?? []),
        db.settings.bulkAdd(settings ?? []),
      ])
    },
  )

  await ensureSeeded()
  return transactions?.length ?? 0
}
