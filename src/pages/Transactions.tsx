import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import CategoryPicker from '../components/CategoryPicker'
import Sheet from '../components/Sheet'
import { db } from '../db/db'
import { useCategoryMap } from '../hooks/data'
import { formatCurrency, formatDate, formatMonthLabel, monthKeyOf } from '../lib/format'
import { computeSummary } from '../lib/stats'
import type { Transaction } from '../types'

// 'all' | 'expense' | 'income' | 'uncategorized' | categoryId
type Filter = 'all' | 'expense' | 'income' | 'uncategorized' | string

export default function Transactions() {
  const catMap = useCategoryMap()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [month, setMonth] = useState('all') // 'all' | 'YYYY-MM'
  const [selected, setSelected] = useState<Transaction | null>(null)

  const transactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().toArray(),
    [],
  )

  const filtered = useMemo(() => {
    let list = transactions ?? []
    if (filter === 'uncategorized') {
      list = list.filter((t) => !t.categoryId)
    } else if (filter === 'expense') {
      list = list.filter((t) => t.amount < 0)
    } else if (filter === 'income') {
      list = list.filter((t) => t.amount > 0)
    } else if (filter !== 'all') {
      list = list.filter((t) => t.categoryId === filter)
    }
    // Mehrere Begriffe per Komma → ODER-Verknüpfung (z. B. "Gehalt, Reise").
    const terms = search
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (terms.length) {
      list = list.filter((t) => {
        const hay = `${t.description} ${t.counterparty} ${t.note}`.toLowerCase()
        return terms.some((term) => hay.includes(term))
      })
    }
    if (month !== 'all') {
      list = list.filter((t) => monthKeyOf(t.date) === month)
    }
    return list
  }, [transactions, filter, search, month])

  // Nach Monat gruppieren.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const key = monthKeyOf(t.date)
      const arr = map.get(key)
      if (arr) arr.push(t)
      else map.set(key, [t])
    }
    return Array.from(map.entries())
  }, [filtered])

  const uncategorizedCount = useMemo(
    () => (transactions ?? []).filter((t) => !t.categoryId).length,
    [transactions],
  )

  // Verfügbare Monate (aus allen Buchungen), neueste zuerst.
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions ?? []) set.add(monthKeyOf(t.date))
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1))
  }, [transactions])

  // Saldo-Übersicht der aktuell gefilterten/gesuchten Auswahl.
  const summary = useMemo(() => computeSummary(filtered), [filtered])

  if (transactions === undefined) return <PageHeader title="Buchungen" />

  return (
    <>
      <PageHeader
        title="Buchungen"
        subtitle={`${transactions.length} Einträge`}
      />

      <input
        type="search"
        placeholder="🔍 Suchen – mehrere mit Komma: z. B. Gehalt, Reise"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <option value="all">🗓️ Alle Monate</option>
        {availableMonths.map((m) => (
          <option key={m} value={m}>
            {formatMonthLabel(m)}
          </option>
        ))}
      </select>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button
          className={'chip' + (filter === 'all' ? ' active' : '')}
          onClick={() => setFilter('all')}
        >
          Alle
        </button>
        <button
          className={'chip' + (filter === 'expense' ? ' active' : '')}
          onClick={() => setFilter('expense')}
        >
          🔻 Ausgaben
        </button>
        <button
          className={'chip' + (filter === 'income' ? ' active' : '')}
          onClick={() => setFilter('income')}
        >
          🔺 Einnahmen
        </button>
        <button
          className={'chip' + (filter === 'uncategorized' ? ' active' : '')}
          onClick={() => setFilter('uncategorized')}
        >
          ❓ Offen{uncategorizedCount ? ` (${uncategorizedCount})` : ''}
        </button>
        {Array.from(catMap.values()).map((c) => (
          <button
            key={c.id}
            className={'chip' + (filter === c.id ? ' active' : '')}
            onClick={() => setFilter(c.id)}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              🔺 Einnahmen
            </span>
            <span
              className="pos"
              style={{
                color: 'var(--success)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCurrency(summary.income)}
            </span>
          </div>
          <div className="row-between">
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              🔻 Ausgaben
            </span>
            <span
              style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              −{formatCurrency(summary.expenses)}
            </span>
          </div>
          <div className="divider" style={{ margin: '10px 0' }} />
          <div className="row-between">
            <span style={{ fontWeight: 700 }}>
              Saldo{' '}
              <span className="muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}>
                ({summary.count})
              </span>
            </span>
            <span
              style={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color:
                  summary.balance >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {formatCurrency(summary.balance)}
            </span>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="Keine Buchungen"
          description={
            transactions.length === 0
              ? 'Erfasse deine erste Buchung oder importiere einen Kontoauszug.'
              : 'Für diesen Filter gibt es keine Einträge.'
          }
        />
      ) : (
        groups.map(([monthKey, items]) => (
          <div key={monthKey}>
            <div className="tx-group-header">{formatMonthLabel(monthKey)}</div>
            {items.map((t) => {
              const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
              return (
                <button
                  key={t.id}
                  className="tx-item"
                  onClick={() => setSelected(t)}
                >
                  <span
                    className="tx-emoji"
                    style={cat ? { background: cat.color + '22' } : undefined}
                  >
                    {cat?.emoji ?? '❓'}
                  </span>
                  <span className="tx-body">
                    <span className="tx-title">
                      {t.description || t.counterparty || 'Buchung'}
                    </span>
                    <span className="tx-sub">
                      {formatDate(t.date)}
                      {t.counterparty ? ` · ${t.counterparty}` : ''}
                      {t.note ? ` · 📝` : ''}
                      {cat?.excludeFromStats ? ' · 🔄 nicht gewertet' : ''}
                    </span>
                  </span>
                  <span className={'tx-amount ' + (t.amount < 0 ? 'neg' : 'pos')}>
                    {formatCurrency(t.amount)}
                  </span>
                </button>
              )
            })}
          </div>
        ))
      )}

      <TransactionDetail tx={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function TransactionDetail({
  tx,
  onClose,
}: {
  tx: Transaction | null
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [initialized, setInitialized] = useState<string | null>(null)

  // Formular beim Öffnen mit der Buchung befüllen.
  if (tx && initialized !== tx.id) {
    setInitialized(tx.id)
    setNote(tx.note)
    setCategoryId(tx.categoryId)
  }

  async function save() {
    if (!tx) return
    await db.transactions.update(tx.id, { note: note.trim(), categoryId })
    onClose()
  }

  async function remove() {
    if (!tx) return
    if (!confirm('Diese Buchung wirklich löschen?')) return
    await db.transactions.delete(tx.id)
    onClose()
  }

  return (
    <Sheet open={!!tx} onClose={onClose} title="Buchung bearbeiten">
      {tx && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row-between">
              <strong>{tx.description || 'Buchung'}</strong>
              <span
                className={'tx-amount ' + (tx.amount < 0 ? 'neg' : 'pos')}
              >
                {formatCurrency(tx.amount)}
              </span>
            </div>
            <p className="hint" style={{ margin: '6px 0 0' }}>
              {formatDate(tx.date)}
              {tx.counterparty ? ` · ${tx.counterparty}` : ''}
            </p>
          </div>

          <div className="field">
            <span className="field-label">Kategorie</span>
            <CategoryPicker value={categoryId} onChange={setCategoryId} />
          </div>

          <label className="field">
            <span className="field-label">Bemerkung</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="stack">
            <button className="btn btn-primary btn-block" onClick={save}>
              Speichern
            </button>
            <button className="btn btn-danger btn-block" onClick={remove}>
              🗑️ Löschen
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
