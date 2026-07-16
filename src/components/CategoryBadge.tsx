import type { Category } from '../types'

interface Props {
  category?: Category
}

/** Kleines Kategorie-Label mit Farbe und Emoji. */
export default function CategoryBadge({ category }: Props) {
  if (!category) {
    return (
      <span className="badge">
        <span className="badge-dot" style={{ background: '#cbd5e1' }} />
        Nicht kategorisiert
      </span>
    )
  }
  return (
    <span className="badge">
      <span className="badge-dot" style={{ background: category.color }} />
      {category.emoji} {category.name}
    </span>
  )
}
