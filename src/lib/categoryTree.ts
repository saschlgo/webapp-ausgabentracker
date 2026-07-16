import type { Category } from '../types'

/**
 * Liefert die ID der Oberkategorie einer Buchung:
 * bei einer Unterkategorie deren `parentId`, sonst die Kategorie selbst.
 */
export function topLevelId(
  catMap: Map<string, Category>,
  categoryId: string | null,
): string | null {
  if (!categoryId) return null
  const c = catMap.get(categoryId)
  if (!c) return categoryId
  return c.parentId ?? categoryId
}

/** Alle Unterkategorien einer Kategorie (nach `order`). */
export function childrenOf(cats: Category[], parentId: string): Category[] {
  return cats
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}

/** true, wenn die Kategorie mindestens eine Unterkategorie hat. */
export function hasChildren(cats: Category[], id: string): boolean {
  return cats.some((c) => c.parentId === id)
}
