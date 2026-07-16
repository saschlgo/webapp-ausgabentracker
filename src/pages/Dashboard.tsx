import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { db } from '../db/db'
import { useCategoryMap } from '../hooks/data'
import { UNCATEGORIZED_COLOR } from '../db/seed'
import { formatCurrency, formatCurrencyShort, formatMonthShort } from '../lib/format'
import { RANGE_LABELS, rangeForPreset, type RangePreset } from '../lib/dateRange'
import type { Category } from '../types'
import {
  computeSummary,
  expensesByCategory,
  filterByRange,
  incomeByCategory,
  monthlyTotals,
  topExpenses,
} from '../lib/stats'

const PRESETS: RangePreset[] = ['thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'all']

export default function Dashboard() {
  const catMap = useCategoryMap()
  const [preset, setPreset] = useState<RangePreset>('thisMonth')
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  const range = useMemo(() => rangeForPreset(preset), [preset])

  // IDs von Kategorien, die aus der Auswertung ausgeschlossen sind (Umbuchungen).
  const excludedIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of catMap.values()) if (c.excludeFromStats) s.add(c.id)
    return s
  }, [catMap])

  // Nur gewertete Buchungen (ohne ausgeschlossene Kategorien).
  const counted = useMemo(
    () =>
      (transactions ?? []).filter(
        (t) => !(t.categoryId && excludedIds.has(t.categoryId)),
      ),
    [transactions, excludedIds],
  )

  const inRange = useMemo(
    () => filterByRange(counted, range.from, range.to),
    [counted, range],
  )

  // Anzahl ausgeschlossener Buchungen im gewählten Zeitraum (nur für Hinweis).
  const excludedInRange = useMemo(
    () =>
      filterByRange(transactions ?? [], range.from, range.to).filter(
        (t) => t.categoryId && excludedIds.has(t.categoryId),
      ).length,
    [transactions, range, excludedIds],
  )

  const summary = useMemo(() => computeSummary(inRange), [inRange])

  // Donut-Daten: Top 6 Kategorien + Rest zusammenfassen.
  const donut = useMemo(() => {
    const byCat = expensesByCategory(inRange)
    const top = byCat.slice(0, 6)
    const rest = byCat.slice(6)
    const restTotal = rest.reduce((s, c) => s + c.total, 0)
    const items = top.map((c) => {
      const cat = c.categoryId ? catMap.get(c.categoryId) : undefined
      return {
        name: cat ? cat.name : 'Nicht kategorisiert',
        emoji: cat?.emoji ?? '❓',
        value: c.total,
        color: cat?.color ?? UNCATEGORIZED_COLOR,
      }
    })
    if (restTotal > 0) {
      items.push({ name: 'Weitere', emoji: '➕', value: restTotal, color: '#cbd5e1' })
    }
    return items
  }, [inRange, catMap])

  // Einnahmen nach Kategorie (z. B. Gehalt vs. Erstattung vs. privat).
  const incomeBreak = useMemo(() => {
    return incomeByCategory(inRange).map((c) => {
      const cat = c.categoryId ? catMap.get(c.categoryId) : undefined
      return {
        name: cat ? cat.name : 'Nicht kategorisiert',
        emoji: cat?.emoji ?? '❓',
        value: c.total,
        color: cat?.color ?? UNCATEGORIZED_COLOR,
      }
    })
  }, [inRange, catMap])

  // Budgets: Ausgaben des laufenden Monats je Kategorie mit Monatslimit.
  const budgets = useMemo(() => {
    const cm = rangeForPreset('thisMonth')
    const monthTx = filterByRange(transactions ?? [], cm.from, cm.to)
    const spentByCat = new Map<string, number>()
    for (const t of monthTx) {
      if (t.amount >= 0 || !t.categoryId) continue
      spentByCat.set(
        t.categoryId,
        (spentByCat.get(t.categoryId) ?? 0) + -t.amount,
      )
    }
    const list: { cat: Category; spent: number; budget: number; pct: number }[] =
      []
    for (const c of catMap.values()) {
      if (!c.budget || c.budget <= 0) continue
      const spent = spentByCat.get(c.id) ?? 0
      list.push({ cat: c, spent, budget: c.budget, pct: spent / c.budget })
    }
    return list.sort((a, b) => b.pct - a.pct)
  }, [transactions, catMap])

  // Verlauf: immer die letzten 6 Monate (unabhängig vom Filter).
  const trend = useMemo(() => {
    const all = monthlyTotals(counted)
    return all.slice(-6)
  }, [counted])

  const top = useMemo(() => topExpenses(inRange, 5), [inRange])

  const uncategorized = useMemo(
    () => (transactions ?? []).filter((t) => !t.categoryId && t.amount < 0).length,
    [transactions],
  )

  if (transactions === undefined) return <PageHeader title="Übersicht" />

  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Übersicht" />
        <EmptyState
          emoji="👋"
          title="Willkommen!"
          description="Noch keine Daten. Erfasse eine Buchung oder importiere einen Kontoauszug, um dein Dashboard zu füllen."
          action={
            <div className="stack">
              <Link className="btn btn-primary" to="/import">
                📥 Kontoauszug importieren
              </Link>
              <Link className="btn" to="/erfassen">
                ＋ Buchung erfassen
              </Link>
            </div>
          }
        />
      </>
    )
  }

  const totalExpenses = summary.expenses || 1
  const totalIncome = summary.income || 1

  return (
    <>
      <PageHeader title="Übersicht" subtitle="Wohin fließt dein Geld?" />

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {PRESETS.map((p) => (
          <button
            key={p}
            className={'chip' + (preset === p ? ' active' : '')}
            onClick={() => setPreset(p)}
          >
            {RANGE_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat-tile">
          <div className="stat-label">Ausgaben</div>
          <div className="stat-value neg">−{formatCurrency(summary.expenses)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Einnahmen</div>
          <div className="stat-value pos">{formatCurrency(summary.income)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Saldo</div>
          <div
            className={'stat-value ' + (summary.balance >= 0 ? 'pos' : 'neg')}
          >
            {formatCurrency(summary.balance)}
          </div>
        </div>
      </div>

      {excludedInRange > 0 && (
        <p className="hint center" style={{ marginTop: -4, marginBottom: 14 }}>
          🔄 {excludedInRange} Umbuchung(en) nicht gewertet
        </p>
      )}

      {uncategorized > 0 && (
        <Link
          to="/transaktionen"
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>❓</span>
          <span style={{ flex: 1 }}>
            <strong>{uncategorized}</strong> Ausgaben ohne Kategorie
            <div className="hint">Tippen, um sie zuzuordnen →</div>
          </span>
        </Link>
      )}

      {/* Budgets (laufender Monat) */}
      {budgets.length > 0 && (
        <div className="card">
          <h3 className="card-title">Budgets · diesen Monat</h3>
          <div className="stack" style={{ gap: 14 }}>
            {budgets.map(({ cat, spent, budget, pct }) => {
              const over = spent > budget
              const remaining = budget - spent
              const barColor =
                pct >= 1
                  ? 'var(--danger)'
                  : pct >= 0.8
                    ? '#f59e0b'
                    : 'var(--success)'
              return (
                <div key={cat.id}>
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>
                      {cat.emoji} {cat.name}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.9rem' }}>
                      {formatCurrency(spent)}{' '}
                      <span className="muted">/ {formatCurrency(budget)}</span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: 'var(--surface-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(pct, 1) * 100}%`,
                        height: '100%',
                        background: barColor,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <div
                    className="hint"
                    style={{
                      marginTop: 4,
                      color: over ? 'var(--danger)' : undefined,
                    }}
                  >
                    {over
                      ? `${formatCurrency(-remaining)} über Budget`
                      : `noch ${formatCurrency(remaining)} · ${Math.round(pct * 100)}%`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ausgaben nach Kategorie */}
      <div className="card">
        <h3 className="card-title">Ausgaben nach Kategorie</h3>
        {donut.length === 0 ? (
          <p className="hint">Keine Ausgaben in diesem Zeitraum.</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donut.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="stack" style={{ marginTop: 8 }}>
              {donut.map((d, i) => (
                <div key={i} className="row-between">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      className="badge-dot"
                      style={{ background: d.color }}
                    />
                    {d.emoji} {d.name}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(d.value)}{' '}
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {Math.round((d.value / totalExpenses) * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Einnahmen nach Kategorie */}
      {incomeBreak.length > 0 && (
        <div className="card">
          <h3 className="card-title">Einnahmen nach Kategorie</h3>
          <div className="stack">
            {incomeBreak.map((d, i) => (
              <div key={i} className="row-between">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className="badge-dot" style={{ background: d.color }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.emoji} {d.name}
                  </span>
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>
                  {formatCurrency(d.value)}{' '}
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {Math.round((d.value / totalIncome) * 100)}%
                  </span>
                </span>
              </div>
            ))}
            {/* Proportionsbalken der Einnahmen-Anteile */}
            <div
              style={{
                display: 'flex',
                height: 10,
                borderRadius: 999,
                overflow: 'hidden',
                marginTop: 4,
              }}
            >
              {incomeBreak.map((d, i) => (
                <span
                  key={i}
                  style={{
                    width: `${(d.value / totalIncome) * 100}%`,
                    background: d.color,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monatsverlauf */}
      <div className="card">
        <h3 className="card-title">Verlauf (letzte 6 Monate)</h3>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={trend} barGap={2}>
              <XAxis
                dataKey="monthKey"
                tickFormatter={formatMonthShort}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number, name) => [
                  formatCurrency(value),
                  name === 'expenses' ? 'Ausgaben' : 'Einnahmen',
                ]}
                labelFormatter={(l) => formatMonthShort(String(l))}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--surface-hover)' }}
              />
              <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          className="row-between"
          style={{ justifyContent: 'center', gap: 20, marginTop: 6 }}
        >
          <span className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="badge-dot" style={{ background: '#6366f1' }} /> Ausgaben
          </span>
          <span className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="badge-dot" style={{ background: '#22c55e' }} /> Einnahmen
          </span>
        </div>
      </div>

      {/* Größte Ausgaben */}
      {top.length > 0 && (
        <div className="card">
          <h3 className="card-title">Größte Ausgaben im Zeitraum</h3>
          <div className="stack">
            {top.map((t) => {
              const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
              return (
                <div key={t.id} className="row-between">
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <span>{cat?.emoji ?? '❓'}</span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.description || t.counterparty || 'Buchung'}
                    </span>
                  </span>
                  <span
                    style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                  >
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="hint center" style={{ marginTop: 16 }}>
        {formatCurrencyShort(summary.expenses)} Ausgaben aus {summary.count}{' '}
        Buchungen · {RANGE_LABELS[preset]}
      </p>
    </>
  )
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: '0.85rem',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-lg)',
}
