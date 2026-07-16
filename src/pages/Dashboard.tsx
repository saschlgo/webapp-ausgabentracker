import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { db } from '../db/db'
import { useCategoryMap, useSettings } from '../hooks/data'
import { UNCATEGORIZED_COLOR } from '../db/seed'
import { currentBalance, monthlyEndBalances } from '../lib/balance'
import { topLevelId } from '../lib/categoryTree'
import type { CategoryTotal } from '../lib/stats'
import { formatCurrency, formatCurrencyShort, formatDate, formatMonthShort } from '../lib/format'
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
  const settings = useSettings()
  const [preset, setPreset] = useState<RangePreset>('thisMonth')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  const anchor = settings?.balanceAnchor

  // Aktueller Kontostand (falls Anker gesetzt).
  const kontostand = useMemo(
    () => (anchor ? currentBalance(transactions ?? [], anchor) : null),
    [transactions, anchor],
  )

  // Kontostand-Verlauf: Monatsend-Stände der letzten 6 Monate.
  const last6MonthKeys = useMemo(() => {
    const keys: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return keys
  }, [])

  const balanceTrend = useMemo(
    () =>
      anchor ? monthlyEndBalances(transactions ?? [], anchor, last6MonthKeys) : [],
    [transactions, anchor, last6MonthKeys],
  )

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

  // Donut-Daten: nach Oberkategorie zusammengefasst, Top 6 + Rest.
  const donut = useMemo(() => {
    const rolls = rollUp(expensesByCategory(inRange), catMap)
    const top = rolls.slice(0, 6)
    const rest = rolls.slice(6)
    const restTotal = rest.reduce((s, r) => s + r.total, 0)
    const items = top.map((r) => {
      const cat = r.key ? catMap.get(r.key) : undefined
      // Aufschlüsselung in Unterkategorien (+ „direkt" auf der Oberkategorie).
      const kids = r.children
        .slice()
        .sort((a, b) => b.total - a.total)
        .map((ch) => {
          const cc = catMap.get(ch.id)
          return {
            name: cc?.name ?? '—',
            emoji: cc?.emoji ?? '',
            color: cc?.color ?? UNCATEGORIZED_COLOR,
            value: ch.total,
          }
        })
      if (kids.length > 0 && r.self > 0 && cat) {
        kids.push({
          name: `Direkt`,
          emoji: cat.emoji,
          color: cat.color,
          value: r.self,
        })
      }
      return {
        key: r.key ?? 'none',
        name: cat ? cat.name : 'Nicht kategorisiert',
        emoji: cat?.emoji ?? '❓',
        value: r.total,
        color: cat?.color ?? UNCATEGORIZED_COLOR,
        children: kids,
      }
    })
    if (restTotal > 0) {
      items.push({
        key: 'more',
        name: 'Weitere',
        emoji: '➕',
        value: restTotal,
        color: '#cbd5e1',
        children: [],
      })
    }
    return items
  }, [inRange, catMap])

  // Einnahmen nach Kategorie (nach Oberkategorie zusammengefasst).
  const incomeBreak = useMemo(() => {
    return rollUp(incomeByCategory(inRange), catMap).map((r) => {
      const cat = r.key ? catMap.get(r.key) : undefined
      return {
        name: cat ? cat.name : 'Nicht kategorisiert',
        emoji: cat?.emoji ?? '❓',
        value: r.total,
        color: cat?.color ?? UNCATEGORIZED_COLOR,
      }
    })
  }, [inRange, catMap])

  // Budgets: Ausgaben des laufenden Monats je Kategorie mit Monatslimit.
  const budgets = useMemo(() => {
    const cm = rangeForPreset('thisMonth')
    const monthTx = filterByRange(transactions ?? [], cm.from, cm.to)
    const list: { cat: Category; spent: number; budget: number; pct: number }[] =
      []
    for (const c of catMap.values()) {
      if (!c.budget || c.budget <= 0) continue
      // Ausgabe der Kategorie inkl. ihrer Unterkategorien.
      let spent = 0
      for (const t of monthTx) {
        if (t.amount >= 0 || !t.categoryId) continue
        const parent = catMap.get(t.categoryId)?.parentId
        if (t.categoryId === c.id || parent === c.id) spent += -t.amount
      }
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

      {kontostand !== null && anchor && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            background:
              'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000))',
            color: '#fff',
            border: 'none',
          }}
        >
          <div style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 600 }}>
            💶 Kontostand
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCurrency(kontostand)}
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: 2 }}>
            Anker: {formatCurrency(anchor.amount)} am {formatDate(anchor.date)}
          </div>
        </div>
      )}

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
              {donut.map((d) => {
                const canExpand = d.children.length > 0
                const open = expandedCat === d.key
                return (
                  <div key={d.key}>
                    <div
                      className="row-between"
                      style={{ cursor: canExpand ? 'pointer' : 'default' }}
                      onClick={
                        canExpand
                          ? () => setExpandedCat(open ? null : d.key)
                          : undefined
                      }
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge-dot" style={{ background: d.color }} />
                        {d.emoji} {d.name}
                        {canExpand && (
                          <span className="muted" style={{ fontSize: '0.8rem' }}>
                            {open ? '▾' : '▸'}
                          </span>
                        )}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(d.value)}{' '}
                        <span className="muted" style={{ fontSize: '0.8rem' }}>
                          {Math.round((d.value / totalExpenses) * 100)}%
                        </span>
                      </span>
                    </div>
                    {open &&
                      d.children.map((ch, j) => (
                        <div
                          key={j}
                          className="row-between"
                          style={{ marginLeft: 22, marginTop: 6 }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: '0.9rem',
                            }}
                          >
                            <span
                              className="badge-dot"
                              style={{ background: ch.color, opacity: 0.7 }}
                            />
                            {ch.emoji} {ch.name}
                          </span>
                          <span
                            className="muted"
                            style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.9rem' }}
                          >
                            {formatCurrency(ch.value)}{' '}
                            {Math.round((ch.value / d.value) * 100)}%
                          </span>
                        </div>
                      ))}
                  </div>
                )
              })}
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

      {/* Kontostand-Verlauf */}
      {anchor && balanceTrend.length > 0 && (
        <div className="card">
          <h3 className="card-title">Kontostand-Verlauf (Monatsende)</h3>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={balanceTrend}>
                <XAxis
                  dataKey="monthKey"
                  tickFormatter={formatMonthShort}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Kontostand']}
                  labelFormatter={(l) => formatMonthShort(String(l))}
                  contentStyle={tooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
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

interface Roll {
  key: string | null
  total: number
  self: number
  children: { id: string; total: number }[]
}

/** Fasst Kategorie-Summen unter ihrer Oberkategorie zusammen. */
function rollUp(raw: CategoryTotal[], catMap: Map<string, Category>): Roll[] {
  const map = new Map<string | null, Roll>()
  for (const e of raw) {
    const key = topLevelId(catMap, e.categoryId)
    let r = map.get(key)
    if (!r) {
      r = { key, total: 0, self: 0, children: [] }
      map.set(key, r)
    }
    r.total += e.total
    if (e.categoryId && e.categoryId !== key) {
      r.children.push({ id: e.categoryId, total: e.total })
    } else {
      r.self += e.total
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}
