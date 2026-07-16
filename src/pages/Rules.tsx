import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import CategoryBadge from '../components/CategoryBadge'
import { db, newId } from '../db/db'
import { sortHierarchical } from '../db/seed'
import { useCategories, useCategoryMap, useRules } from '../hooks/data'
import { categorizeByRules } from '../lib/categorize'
import type { RuleField } from '../types'

const FIELD_LABELS: Record<RuleField, string> = {
  any: 'Zweck oder Empfänger',
  description: 'Verwendungszweck',
  counterparty: 'Empfänger',
}

export default function Rules() {
  const rules = useRules()
  const categories = useCategories()
  const catMap = useCategoryMap()

  const [pattern, setPattern] = useState('')
  const [field, setField] = useState<RuleField>('any')
  const [categoryId, setCategoryId] = useState('')
  const [applied, setApplied] = useState<number | null>(null)

  async function addRule() {
    if (!pattern.trim() || !categoryId) return
    await db.rules.add({
      id: newId(),
      field,
      pattern: pattern.trim(),
      categoryId,
      createdAt: new Date().toISOString(),
    })
    setPattern('')
  }

  async function deleteRule(id: string) {
    await db.rules.delete(id)
  }

  // Regeln anwenden. Bei all=false nur auf nicht kategorisierte Buchungen,
  // bei all=true auf alle (passende Regel überschreibt bestehende Kategorie).
  async function applyRules(all: boolean) {
    const allRules = await db.rules.toArray()
    if (allRules.length === 0) return
    if (all) {
      const ok = confirm(
        'Regeln auf ALLE Buchungen anwenden? Bereits zugeordnete Buchungen, auf die eine Regel passt, werden dabei überschrieben.',
      )
      if (!ok) return
    }
    const list = all
      ? await db.transactions.toArray()
      : await db.transactions.filter((t) => !t.categoryId).toArray()
    let count = 0
    for (const t of list) {
      const cat = categorizeByRules(t, allRules)
      if (cat && cat !== t.categoryId) {
        await db.transactions.update(t.id, { categoryId: cat })
        count++
      }
    }
    setApplied(count)
  }

  return (
    <>
      <PageHeader
        title="Regeln"
        subtitle="Automatisch kategorisieren"
        action={
          <Link to="/mehr" className="btn-ghost" style={{ padding: '6px 8px' }}>
            ← Mehr
          </Link>
        }
      />

      <div className="card">
        <h3 className="card-title">Neue Regel</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Wenn ein Text vorkommt, wird die Buchung automatisch dieser Kategorie
          zugeordnet – beim Import und auf Wunsch auch nachträglich.
        </p>
        <label className="field">
          <span className="field-label">Enthält Text</span>
          <input
            type="text"
            placeholder="z. B. REWE, Netflix, Tankstelle"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">In Feld</span>
          <select
            value={field}
            onChange={(e) => setField(e.target.value as RuleField)}
          >
            <option value="any">Zweck oder Empfänger</option>
            <option value="description">Verwendungszweck</option>
            <option value="counterparty">Empfänger</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Kategorie</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— wählen —</option>
            {sortHierarchical(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '↳ ' : ''}
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-primary btn-block"
          onClick={addRule}
          disabled={!pattern.trim() || !categoryId}
        >
          Regel hinzufügen
        </button>
      </div>

      {rules && rules.length > 0 ? (
        <>
          <div className="card">
            <h3 className="card-title">Aktive Regeln ({rules.length})</h3>
            <div className="stack">
              {rules.map((r) => (
                <div key={r.id} className="row-between">
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>„{r.pattern}"</div>
                    <div className="hint">
                      {FIELD_LABELS[r.field]} →{' '}
                      <CategoryBadge category={catMap.get(r.categoryId)} />
                    </div>
                  </span>
                  <button
                    className="btn-ghost text-danger"
                    onClick={() => deleteRule(r.id)}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="stack">
            <button className="btn btn-block" onClick={() => applyRules(false)}>
              🔄 Auf offene Buchungen anwenden
            </button>
            <button className="btn btn-block" onClick={() => applyRules(true)}>
              ♻️ Auf alle Buchungen anwenden
            </button>
          </div>
          {applied !== null && (
            <p className="hint center">
              {applied} Buchung(en) neu zugeordnet.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          emoji="🪄"
          title="Noch keine Regeln"
          description="Lege Regeln an, damit importierte Buchungen automatisch die richtige Kategorie bekommen."
        />
      )}
    </>
  )
}
