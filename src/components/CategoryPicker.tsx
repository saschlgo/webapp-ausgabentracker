import { useCategories } from '../hooks/data'
import type { CategoryKind } from '../types'

interface Props {
  value: string | null
  onChange: (categoryId: string | null) => void
  /** Nur Kategorien dieser Art zeigen (plus 'both'). */
  filterKind?: CategoryKind
  allowNone?: boolean
}

/** Grid aus auswählbaren Kategorie-Kacheln. */
export default function CategoryPicker({
  value,
  onChange,
  filterKind,
  allowNone = true,
}: Props) {
  const categories = useCategories()

  const list = (categories ?? []).filter((c) => {
    if (!filterKind) return true
    return c.kind === filterKind || c.kind === 'both'
  })

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}
    >
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
      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          className="cat-cell"
          data-active={value === c.id}
          style={
            value === c.id
              ? { borderColor: c.color, background: c.color + '18' }
              : undefined
          }
          onClick={() => onChange(c.id)}
        >
          <span className="cat-emoji">{c.emoji}</span>
          <span className="cat-name">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
