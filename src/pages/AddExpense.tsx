import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import CategoryPicker from '../components/CategoryPicker'
import { db, newId } from '../db/db'
import { makeDedupHash } from '../lib/dedup'
import { parseAmount } from '../lib/csv'
import { todayIso } from '../lib/dateRange'
import type { Transaction } from '../types'

type Kind = 'expense' | 'income'

export default function AddExpense() {
  const navigate = useNavigate()
  const [kind, setKind] = useState<Kind>('expense')
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(todayIso())
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [counterparty, setCounterparty] = useState('')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError('')
    const magnitude = Math.abs(parseAmount(amountText, ','))
    if (!magnitude || isNaN(magnitude)) {
      setError('Bitte einen gültigen Betrag eingeben.')
      return
    }
    if (!date) {
      setError('Bitte ein Datum wählen.')
      return
    }

    const amount = kind === 'expense' ? -magnitude : magnitude
    const desc = description.trim() || (kind === 'expense' ? 'Ausgabe' : 'Einnahme')

    const tx: Transaction = {
      id: newId(),
      date,
      amount,
      description: desc,
      counterparty: counterparty.trim(),
      categoryId,
      note: note.trim(),
      source: 'manual',
      dedupHash: makeDedupHash({
        date,
        amount,
        description: desc,
        counterparty,
      }),
      createdAt: new Date().toISOString(),
    }

    setSaving(true)
    try {
      await db.transactions.add(tx)
      navigate('/transaktionen')
    } catch (e) {
      setError('Speichern fehlgeschlagen: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Neue Buchung" subtitle="Ausgabe oder Einnahme erfassen" />

      <div className="card">
        <div className="segmented" style={{ marginBottom: 18 }}>
          <button
            className={kind === 'expense' ? 'active' : ''}
            onClick={() => setKind('expense')}
          >
            🔻 Ausgabe
          </button>
          <button
            className={kind === 'income' ? 'active' : ''}
            onClick={() => setKind('income')}
          >
            🔺 Einnahme
          </button>
        </div>

        <label className="field">
          <span className="field-label">Betrag (€)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="z. B. 12,50"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            style={{ fontSize: '1.6rem', fontWeight: 700, textAlign: 'center' }}
          />
        </label>

        <label className="field">
          <span className="field-label">Datum</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Beschreibung</span>
          <input
            type="text"
            placeholder="Wofür?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">
            {kind === 'expense' ? 'Empfänger' : 'Von'}
          </span>
          <input
            type="text"
            placeholder="optional"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field-label">Kategorie</span>
          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            filterKind={kind}
          />
        </div>

        <label className="field">
          <span className="field-label">Bemerkung</span>
          <textarea
            placeholder="Notiz (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && <p className="text-danger hint">{error}</p>}

        <button
          className="btn btn-primary btn-block"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Speichern …' : 'Buchung speichern'}
        </button>
      </div>
    </>
  )
}
