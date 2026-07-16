import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import { db, newId } from '../db/db'
import { useCategories } from '../hooks/data'
import { parseAmount } from '../lib/csv'
import { formatCurrency } from '../lib/format'
import type { Category, CategoryKind } from '../types'

const EMOJI_CHOICES = [
  // Alltag
  '🛒','🏠','🚗','🎉','🎰','🎲','💊','🛍️','🔁','🍽️','✈️','📚','🛡️','💰','☕','⛽','📱','🎮','🎁','🐾','💡','🏋️','👕','💇','🎓',
  // Finanzen / Sparen / Investieren
  '📈','📉','📊','💹','🏦','🐷','🪙','💳','🧾','💼','🏢','🤝',
  // Handel / Versand / Sonstiges
  '📦','🏷️','🖥️','🎟️','🍺','🚕','🏥','🧸','🔧','🌐','❤️','❓',
]

const COLOR_CHOICES = [
  '#22c55e','#3b82f6','#f97316','#a855f7','#d97706','#ef4444','#ec4899','#14b8a6','#eab308','#06b6d4','#6366f1','#64748b','#16a34a','#94a3b8',
]

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: 'Ausgabe',
  income: 'Einnahme',
  both: 'Beides',
}

export default function Categories() {
  const categories = useCategories()
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Kategorien"
        subtitle="Verwalten & anpassen"
        action={
          <Link to="/mehr" className="btn-ghost" style={{ padding: '6px 8px' }}>
            ← Mehr
          </Link>
        }
      />

      <button
        className="btn btn-primary btn-block"
        style={{ marginBottom: 14 }}
        onClick={() => setCreating(true)}
      >
        ＋ Neue Kategorie
      </button>

      <div className="stack">
        {(categories ?? []).map((c) => (
          <button
            key={c.id}
            className="tx-item"
            onClick={() => setEditing(c)}
          >
            <span className="tx-emoji" style={{ background: c.color + '22' }}>
              {c.emoji}
            </span>
            <span className="tx-body">
              <span className="tx-title">{c.name}</span>
              <span className="tx-sub">
                {KIND_LABELS[c.kind]}
                {c.budget ? ` · 🎯 ${formatCurrency(c.budget)}/Monat` : ''}
                {c.excludeFromStats ? ' · 🔄 nicht gewertet' : ''}
              </span>
            </span>
            <span className="badge-dot" style={{ background: c.color }} />
          </button>
        ))}
      </div>

      {(creating || editing) && (
        <CategoryEditor
          category={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </>
  )
}

function CategoryEditor({
  category,
  onClose,
}: {
  category: Category | null
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [emoji, setEmoji] = useState(category?.emoji ?? '❓')
  const [color, setColor] = useState(category?.color ?? COLOR_CHOICES[0])
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense')
  const [excludeFromStats, setExcludeFromStats] = useState(
    category?.excludeFromStats ?? false,
  )
  const [budgetText, setBudgetText] = useState(
    category?.budget ? String(category.budget).replace('.', ',') : '',
  )

  async function save() {
    if (!name.trim()) return
    const parsedBudget = Math.abs(parseAmount(budgetText, ','))
    const budget = budgetText.trim() && !isNaN(parsedBudget) ? parsedBudget : 0
    if (category) {
      await db.categories.update(category.id, {
        name: name.trim(),
        emoji,
        color,
        kind,
        excludeFromStats,
        budget,
      })
    } else {
      await db.categories.add({
        id: newId(),
        name: name.trim(),
        emoji,
        color,
        kind,
        order: 50,
        excludeFromStats,
        budget,
      })
    }
    onClose()
  }

  async function remove() {
    if (!category) return
    if (
      !confirm(
        `Kategorie "${category.name}" löschen? Zugeordnete Buchungen werden auf "nicht kategorisiert" gesetzt.`,
      )
    )
      return
    await db.transaction('rw', [db.transactions, db.rules, db.categories], async () => {
      const affected = await db.transactions
        .where('categoryId')
        .equals(category.id)
        .toArray()
      await Promise.all(
        affected.map((t) => db.transactions.update(t.id, { categoryId: null })),
      )
      const rules = await db.rules.where('categoryId').equals(category.id).toArray()
      await Promise.all(rules.map((r) => db.rules.delete(r.id)))
      await db.categories.delete(category.id)
    })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={category ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <span
          className="tx-emoji"
          style={{ background: color + '22', width: 56, height: 56, fontSize: '1.7rem' }}
        >
          {emoji}
        </span>
        <input
          type="text"
          placeholder="Name der Kategorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="field">
        <span className="field-label">Art</span>
        <div className="segmented">
          {(['expense', 'income', 'both'] as CategoryKind[]).map((k) => (
            <button
              key={k}
              className={kind === k ? 'active' : ''}
              onClick={() => setKind(k)}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Symbol</span>
        <div className="chip-row" style={{ flexWrap: 'wrap' }}>
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              className="chip"
              style={{
                fontSize: '1.2rem',
                background: emoji === e ? 'var(--accent-soft)' : undefined,
                borderColor: emoji === e ? 'var(--accent)' : undefined,
              }}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Farbe</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLOR_CHOICES.map((col) => (
            <button
              key={col}
              onClick={() => setColor(col)}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: col,
                border: color === col ? '3px solid var(--text)' : '2px solid var(--border)',
                cursor: 'pointer',
              }}
              aria-label={col}
            />
          ))}
        </div>
      </div>

      {kind !== 'income' && (
        <label className="field">
          <span className="field-label">Monatsbudget (€, optional)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="z. B. 150 – leer = kein Budget"
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
          />
        </label>
      )}

      <button
        type="button"
        className="row-between"
        onClick={() => setExcludeFromStats((v) => !v)}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          textAlign: 'left',
          color: 'inherit',
          marginBottom: 4,
        }}
      >
        <span style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>🔄 Nicht in Auswertung zählen</div>
          <div className="hint">
            Für Umbuchungen zwischen eigenen Konten – zählt nicht zu
            Ausgaben/Einnahmen.
          </div>
        </span>
        <span
          aria-hidden
          style={{
            flex: '0 0 auto',
            width: 46,
            height: 28,
            borderRadius: 999,
            background: excludeFromStats ? 'var(--accent)' : 'var(--border)',
            position: 'relative',
            transition: 'background 0.15s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: excludeFromStats ? 21 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.15s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          />
        </span>
      </button>

      <div className="stack" style={{ marginTop: 8 }}>
        <button className="btn btn-primary btn-block" onClick={save}>
          Speichern
        </button>
        {category && (
          <button className="btn btn-danger btn-block" onClick={remove}>
            🗑️ Kategorie löschen
          </button>
        )}
      </div>
    </Sheet>
  )
}
