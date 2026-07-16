import { useMemo, useRef, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import {
  detectDelimiter,
  detectEncoding,
  guessColumns,
  guessDateFormat,
  guessDecimalSeparator,
  parseAmount,
  parseDate,
  parseRaw,
  readFileWithEncoding,
  type Encoding,
} from '../lib/csv'
import { makeDedupHash, splitDuplicates } from '../lib/dedup'
import { categorizeByRules } from '../lib/categorize'
import { formatCurrency, formatDate } from '../lib/format'
import { useImportPresets } from '../hooks/data'
import type {
  AmountMode,
  DecimalSeparator,
  ImportPreset,
  Rule,
  Transaction,
} from '../types'

interface WorkingConfig {
  encoding: Encoding
  delimiter: string
  skipRows: number
  decimalSeparator: DecimalSeparator
  dateFormat: string
  amountMode: AmountMode
  columns: {
    date: string
    amount?: string
    debit?: string
    credit?: string
    description?: string
    counterparty?: string
  }
}

interface ImportResult {
  added: number
  duplicates: number
  invalid: number
}

const NONE = '__none__'

export default function Import() {
  const presets = useImportPresets()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [config, setConfig] = useState<WorkingConfig | null>(null)
  const [presetName, setPresetName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reparseWith(rows: string[][], enc: Encoding, delim: string) {
    const cfgBase = { encoding: enc, delimiter: delim, skipRows: 0 }
    const headers = rows[0] ?? []
    const guessed = guessColumns(headers)
    // Beispielwerte für Betrag/Datum sammeln.
    const dataRows = rows.slice(1, 8)
    const dateIdx = headers.indexOf(guessed.date)
    const amountIdx = guessed.amount ? headers.indexOf(guessed.amount) : -1
    const dateSamples = dataRows.map((r) => r[dateIdx] ?? '').filter(Boolean)
    const amountSamples =
      amountIdx >= 0 ? dataRows.map((r) => r[amountIdx] ?? '') : []

    setConfig({
      ...cfgBase,
      decimalSeparator: guessDecimalSeparator(amountSamples),
      dateFormat: dateSamples.length ? guessDateFormat(dateSamples[0]) : 'DD.MM.YYYY',
      amountMode: guessed.amountMode,
      columns: {
        date: guessed.date,
        amount: guessed.amount,
        debit: guessed.debit,
        credit: guessed.credit,
        description: guessed.description,
        counterparty: guessed.counterparty,
      },
    })
  }

  async function handleFile(f: File) {
    setError('')
    setResult(null)
    setFile(f)
    setFileName(f.name)
    try {
      const enc = await detectEncoding(f)
      const text = await readFileWithEncoding(f, enc)
      const delim = detectDelimiter(text)
      const rows = parseRaw(text, delim)
      if (rows.length < 2) {
        setError('Die Datei enthält keine erkennbaren Datenzeilen.')
        setRawRows([])
        setConfig(null)
        return
      }
      setRawText(text)
      setRawRows(rows)
      await reparseWith(rows, enc, delim)
    } catch (e) {
      setError('Datei konnte nicht gelesen werden: ' + (e as Error).message)
    }
  }

  // Encoding-Wechsel: Datei mit neuem Encoding erneut einlesen.
  async function changeEncoding(enc: Encoding) {
    if (!file || !config) return
    try {
      const text = await readFileWithEncoding(file, enc)
      const rows = parseRaw(text, config.delimiter)
      setRawText(text)
      setRawRows(rows)
      setConfig({ ...config, encoding: enc })
    } catch (e) {
      setError('Neu-Einlesen fehlgeschlagen: ' + (e as Error).message)
    }
  }

  // Trennzeichen-Wechsel: bereits dekodierten Text neu aufteilen.
  function changeDelimiter(delim: string) {
    if (!config) return
    const rows = parseRaw(rawText, delim)
    setRawRows(rows)
    setConfig({ ...config, delimiter: delim })
  }

  // Header und Datenzeilen abhängig von skipRows.
  const headers = config ? rawRows[config.skipRows] ?? [] : []
  const dataRows = config ? rawRows.slice(config.skipRows + 1) : []

  // Live-Vorschau der geparsten Buchungen.
  const preview = useMemo(() => {
    if (!config) return []
    return dataRows.slice(0, 5).map((row) => buildRecord(row, headers, config))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, rawRows])

  function applyPreset(p: ImportPreset) {
    setConfig({
      encoding: p.encoding,
      delimiter: p.delimiter,
      skipRows: p.skipRows,
      decimalSeparator: p.decimalSeparator,
      dateFormat: p.dateFormat,
      amountMode: p.amountMode,
      columns: { ...p.columns },
    })
    setPresetName(p.name)
  }

  async function savePreset() {
    if (!config || !presetName.trim()) return
    const preset: ImportPreset = {
      id: newId(),
      name: presetName.trim(),
      encoding: config.encoding,
      delimiter: config.delimiter,
      skipRows: config.skipRows,
      decimalSeparator: config.decimalSeparator,
      dateFormat: config.dateFormat,
      amountMode: config.amountMode,
      columns: { ...config.columns },
      createdAt: new Date().toISOString(),
    }
    await db.importPresets.add(preset)
  }

  async function runImport() {
    if (!config) return
    setBusy(true)
    setError('')
    try {
      const rules: Rule[] = await db.rules.toArray()
      const candidates: Transaction[] = []
      let invalid = 0

      for (const row of dataRows) {
        const rec = buildRecord(row, headers, config)
        if (!rec.valid || rec.date === null) {
          invalid++
          continue
        }
        const categoryId = categorizeByRules(
          { description: rec.description, counterparty: rec.counterparty },
          rules,
        )
        candidates.push({
          id: newId(),
          date: rec.date,
          amount: rec.amount,
          description: rec.description,
          counterparty: rec.counterparty,
          categoryId,
          note: '',
          source: 'import',
          dedupHash: makeDedupHash({
            date: rec.date,
            amount: rec.amount,
            description: rec.description,
            counterparty: rec.counterparty,
          }),
          createdAt: new Date().toISOString(),
        })
      }

      const existing = await db.transactions.toArray()
      const existingHashes = new Set(existing.map((t) => t.dedupHash))
      const { fresh, duplicates } = splitDuplicates(candidates, existingHashes)

      if (fresh.length) await db.transactions.bulkAdd(fresh)

      setResult({
        added: fresh.length,
        duplicates: duplicates.length,
        invalid,
      })
    } catch (e) {
      setError('Import fehlgeschlagen: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setFile(null)
    setFileName('')
    setRawText('')
    setRawRows([])
    setConfig(null)
    setResult(null)
    setPresetName('')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const headerOptions = headers.map((h, i) => ({
    value: h,
    label: h || `Spalte ${i + 1}`,
  }))

  return (
    <>
      <PageHeader
        title="Kontoauszug importieren"
        subtitle="CSV aus dem Online-Banking"
      />

      {/* Datei-Auswahl */}
      <div className="card">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <button
          className="btn btn-primary btn-block"
          onClick={() => fileInputRef.current?.click()}
        >
          📂 CSV-Datei wählen
        </button>
        {fileName && (
          <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
            Gewählt: <strong>{fileName}</strong> · {rawRows.length} Zeilen
            {config && (
              <>
                {' '}
                <button
                  className="btn-ghost"
                  style={{ padding: '2px 6px' }}
                  onClick={reset}
                >
                  zurücksetzen
                </button>
              </>
            )}
          </p>
        )}
        {error && <p className="text-danger hint">{error}</p>}
      </div>

      {/* Ergebnis */}
      {result && (
        <div className="card" style={{ borderColor: 'var(--success)' }}>
          <h3 className="card-title">✅ Import abgeschlossen</h3>
          <div className="stack">
            <div className="row-between">
              <span>Neu importiert</span>
              <strong>{result.added}</strong>
            </div>
            <div className="row-between">
              <span className="muted">Duplikate übersprungen</span>
              <span>{result.duplicates}</span>
            </div>
            {result.invalid > 0 && (
              <div className="row-between">
                <span className="muted">Ungültige Zeilen</span>
                <span>{result.invalid}</span>
              </div>
            )}
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <button className="btn" onClick={reset}>
              Weiteren Auszug importieren
            </button>
          </div>
        </div>
      )}

      {/* Konfiguration */}
      {config && !result && (
        <>
          {presets && presets.length > 0 && (
            <div className="card">
              <h3 className="card-title">Gespeicherte Vorlagen</h3>
              <div className="chip-row">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    className="chip"
                    onClick={() => applyPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="card-title">Format</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">Encoding</span>
                <select
                  value={config.encoding}
                  onChange={(e) => changeEncoding(e.target.value as Encoding)}
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252</option>
                  <option value="iso-8859-1">ISO-8859-1</option>
                </select>
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">Trennzeichen</span>
                <select
                  value={config.delimiter}
                  onChange={(e) => changeDelimiter(e.target.value)}
                >
                  <option value=";">Semikolon (;)</option>
                  <option value=",">Komma (,)</option>
                  <option value={'\t'}>Tab</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">Kopfzeilen überspringen</span>
                <input
                  type="number"
                  min={0}
                  value={config.skipRows}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      skipRows: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">Dezimaltrenner</span>
                <select
                  value={config.decimalSeparator}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      decimalSeparator: e.target.value as DecimalSeparator,
                    })
                  }
                >
                  <option value=",">Komma (12,50)</option>
                  <option value=".">Punkt (12.50)</option>
                </select>
              </label>
            </div>
            <label className="field" style={{ marginTop: 10, marginBottom: 0 }}>
              <span className="field-label">Datumsformat</span>
              <select
                value={config.dateFormat}
                onChange={(e) =>
                  setConfig({ ...config, dateFormat: e.target.value })
                }
              >
                <option value="DD.MM.YYYY">TT.MM.JJJJ</option>
                <option value="DD.MM.YY">TT.MM.JJ</option>
                <option value="YYYY-MM-DD">JJJJ-MM-TT</option>
                <option value="DD/MM/YYYY">TT/MM/JJJJ</option>
              </select>
            </label>
          </div>

          <div className="card">
            <h3 className="card-title">Spalten zuordnen</h3>

            <ColumnSelect
              label="Datum"
              value={config.columns.date}
              options={headerOptions}
              onChange={(v) =>
                setConfig({ ...config, columns: { ...config.columns, date: v } })
              }
            />

            <label className="field">
              <span className="field-label">Betrag als …</span>
              <div className="segmented">
                <button
                  className={config.amountMode === 'single' ? 'active' : ''}
                  onClick={() => setConfig({ ...config, amountMode: 'single' })}
                >
                  Eine Spalte
                </button>
                <button
                  className={config.amountMode === 'debitCredit' ? 'active' : ''}
                  onClick={() =>
                    setConfig({ ...config, amountMode: 'debitCredit' })
                  }
                >
                  Soll / Haben
                </button>
              </div>
            </label>

            {config.amountMode === 'single' ? (
              <ColumnSelect
                label="Betrag (mit Vorzeichen)"
                value={config.columns.amount ?? NONE}
                options={headerOptions}
                onChange={(v) =>
                  setConfig({
                    ...config,
                    columns: { ...config.columns, amount: undefined2(v) },
                  })
                }
              />
            ) : (
              <>
                <ColumnSelect
                  label="Soll / Belastung (Ausgabe)"
                  value={config.columns.debit ?? NONE}
                  options={headerOptions}
                  onChange={(v) =>
                    setConfig({
                      ...config,
                      columns: { ...config.columns, debit: undefined2(v) },
                    })
                  }
                />
                <ColumnSelect
                  label="Haben / Gutschrift (Einnahme)"
                  value={config.columns.credit ?? NONE}
                  options={headerOptions}
                  onChange={(v) =>
                    setConfig({
                      ...config,
                      columns: { ...config.columns, credit: undefined2(v) },
                    })
                  }
                />
              </>
            )}

            <ColumnSelect
              label="Verwendungszweck"
              value={config.columns.description ?? NONE}
              options={headerOptions}
              onChange={(v) =>
                setConfig({
                  ...config,
                  columns: { ...config.columns, description: undefined2(v) },
                })
              }
            />
            <ColumnSelect
              label="Empfänger / Zahler"
              value={config.columns.counterparty ?? NONE}
              options={headerOptions}
              onChange={(v) =>
                setConfig({
                  ...config,
                  columns: { ...config.columns, counterparty: undefined2(v) },
                })
              }
            />
          </div>

          {/* Vorschau */}
          <div className="card">
            <h3 className="card-title">Vorschau (erste 5 Zeilen)</h3>
            <div className="stack">
              {preview.map((p, i) => (
                <div
                  key={i}
                  className="row-between"
                  style={{ opacity: p.valid ? 1 : 0.5 }}
                >
                  <span style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.description || p.counterparty || '—'}
                    </div>
                    <div className="hint">
                      {p.date ? formatDate(p.date) : '⚠️ Datum ungültig'}
                    </div>
                  </span>
                  <span
                    className={
                      'tx-amount ' + (p.amount < 0 ? 'neg' : 'pos')
                    }
                  >
                    {isNaN(p.amount) ? '—' : formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Vorlage speichern */}
          <div className="card">
            <h3 className="card-title">Als Vorlage speichern</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="z. B. Sparkasse Giro"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <button
                className="btn"
                onClick={savePreset}
                disabled={!presetName.trim()}
              >
                Speichern
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 4 }}
            onClick={runImport}
            disabled={busy}
          >
            {busy ? 'Importiere …' : `📥 ${dataRows.length} Buchungen importieren`}
          </button>
        </>
      )}
    </>
  )
}

function undefined2(v: string): string | undefined {
  return v === NONE ? undefined : v
}

interface PreviewRecord {
  date: string | null
  amount: number
  description: string
  counterparty: string
  valid: boolean
}

/** Baut aus einer Rohzeile eine Buchung gemäß Konfiguration. */
function buildRecord(
  row: string[],
  headers: string[],
  config: WorkingConfig,
): PreviewRecord {
  const idx = (name?: string) => (name ? headers.indexOf(name) : -1)
  const cell = (name?: string) => {
    const i = idx(name)
    return i >= 0 ? (row[i] ?? '').trim() : ''
  }

  const dateRaw = cell(config.columns.date)
  const date = parseDate(dateRaw, config.dateFormat)

  let amount = NaN
  if (config.amountMode === 'single') {
    amount = parseAmount(cell(config.columns.amount), config.decimalSeparator)
  } else {
    const debit = parseAmount(cell(config.columns.debit), config.decimalSeparator)
    const credit = parseAmount(cell(config.columns.credit), config.decimalSeparator)
    const d = isNaN(debit) ? 0 : Math.abs(debit)
    const c = isNaN(credit) ? 0 : Math.abs(credit)
    amount = c - d
  }

  const description = cell(config.columns.description)
  const counterparty = cell(config.columns.counterparty)

  const valid = date !== null && !isNaN(amount) && amount !== 0

  return { date, amount: isNaN(amount) ? NaN : amount, description, counterparty, valid }
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={NONE}>— keine —</option>
        {options.map((o, i) => (
          <option key={i} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
