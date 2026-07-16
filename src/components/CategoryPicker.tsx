import { useState } from 'react'
import { useCategories } from '../hooks/data'
import { childrenOf, hasChildren } from '../lib/categoryTree'
import type { Category, CategoryKind } from '../types'

interface Props {
  value: string | null
  onChange: (categoryId: string | null) => void
  /** Nur Kategorien dieser Art zeigen (plus 'both'). */
  filterKind?: CategoryKind
  allowNone?: boolean
}

/** Grid aus auswählbaren Kategorie-Kacheln – mit Unterkategorien (2 Ebenen). */
export default function CategoryPicker({
  value,
  onChange,
  filterKind,
  allowNone = true,
}: Props) {
  const categories = useCategories() ?? []
  const [expanded, setExpanded] = useState<string | null>(null)

  const matchesKind = (c: Category) =>
    !filterKind || c.kind === filterKind || c.kind === 'both'

  const topLevel = categories.filter((c) => !c.parentId && matchesKind(c))

  // Unterkategorie-Ansicht
  if (expanded) {
    const parent = categories.find((c) => c.id === expanded)
    const kids = childrenOf(categories, expanded).filter(matchesKind)
    return (
      <div>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px 6px', marginBottom: 8 }}
          onClick={() => setExpanded(null)}
        >
          ‹ Zurück
        </button>
        <div style={gridStyle}>
          <button
            type="button"
            className="cat-cell"
            data-active={value === parent?.id}
            onClick={() => onChange(parent!.id)}
          >
            <span className="cat-emoji">{parent?.emoji}</span>
            <span className="cat-name">Ganze {parent?.name}</span>
          </button>
          {kids.map((c) => (
            <CatCell key={c.id} cat={c} active={value === c.id} onClick={() => onChange(c.id)} />
          ))}
        </div>
      </div>
    )
  }

  // Oberkategorie-Ansicht
  const selectedChild =
    value != null
      ? categories.find((c) => c.id === value && c.parentId)
      : undefined

  return (
    <div style={gridStyle}>
      {allowNone && (
        <button
          type="button"
          className="cat-cell"
          data-active={value === null}
          onClick={() => onChange(null)}
        >
          <span className="cat-emoji">➖</span>
          <span className="cat-name">Keine</span>
        </button>
      )}
      {topLevel.map((c) => {
        const withKids = hasChildren(categories, c.id)
        const active =
          value === c.id || (selectedChild && selectedChild.parentId === c.id)
        const subLabel =
          selectedChild && selectedChild.parentId === c.id
            ? selectedChild.name
            : null
        return (
          <button
            key={c.id}
            type="button"
            className="cat-cell"
            data-active={!!active}
            style={
              active ? { borderColor: c.color, background: c.color + '18' } : undefined
            }
            onClick={() => (withKids ? setExpanded(c.id) : onChange(c.id))}
          >
            <span className="cat-emoji">{c.emoji}</span>
            <span className="cat-name">
              {c.name}
              {withKids ? ' ›' : ''}
            </span>
            {subLabel && (
              <span
                className="cat-name"
                style={{ color: c.color, fontWeight: 700 }}
              >
                ▸ {subLabel}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function CatCell({
  cat,
  active,
  onClick,
}: {
  cat: Category
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="cat-cell"
      data-active={active}
      style={active ? { borderColor: cat.color, background: cat.color + '18' } : undefined}
      onClick={onClick}
    >
      <span className="cat-emoji">{cat.emoji}</span>
      <span className="cat-name">{cat.name}</span>
    </button>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
}
