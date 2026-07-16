import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Category } from '../types'

/** Alle Kategorien, nach `order` sortiert. */
export function useCategories(): Category[] | undefined {
  return useLiveQuery(async () => {
    const cats = await db.categories.toArray()
    return cats.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  }, [])
}

/** Nachschlage-Map von Kategorie-ID auf Kategorie. */
export function useCategoryMap(): Map<string, Category> {
  const cats = useCategories()
  const map = new Map<string, Category>()
  for (const c of cats ?? []) map.set(c.id, c)
  return map
}

/** App-Einstellungen. */
export function useSettings() {
  return useLiveQuery(() => db.settings.get('app'), [])
}

/** Alle Auto-Kategorisierungs-Regeln. */
export function useRules() {
  return useLiveQuery(() => db.rules.toArray(), [])
}

/** Gespeicherte Import-Vorlagen. */
export function useImportPresets() {
  return useLiveQuery(() => db.importPresets.toArray(), [])
}
