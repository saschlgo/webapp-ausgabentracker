import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../components/PageHeader'
import { db, wipeAllData } from '../db/db'
import { useSettings } from '../hooks/data'
import { exportBackup, importBackup } from '../lib/backup'
import type { Settings as AppSettings } from '../types'

export default function Settings() {
  const settings = useSettings()
  const importRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const txCount = useLiveQuery(() => db.transactions.count(), [])
  const catCount = useLiveQuery(() => db.categories.count(), [])

  async function setTheme(theme: AppSettings['theme']) {
    await db.settings.update('app', { theme })
  }

  async function handleImport(file: File) {
    try {
      const n = await importBackup(file)
      setMessage(`✅ Backup importiert – ${n} Buchungen wiederhergestellt.`)
    } catch (e) {
      setMessage('❌ ' + (e as Error).message)
    }
    if (importRef.current) importRef.current.value = ''
  }

  async function handleWipe() {
    if (
      !confirm(
        'Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden. Erstelle vorher ggf. ein Backup.',
      )
    )
      return
    await wipeAllData()
    setMessage('🧹 Alle Daten wurden gelöscht.')
  }

  const theme = settings?.theme ?? 'system'

  return (
    <>
      <PageHeader title="Mehr" subtitle="Einstellungen & Daten" />

      {message && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Darstellung</h3>
        <div className="segmented">
          <button
            className={theme === 'system' ? 'active' : ''}
            onClick={() => setTheme('system')}
          >
            Automatisch
          </button>
          <button
            className={theme === 'light' ? 'active' : ''}
            onClick={() => setTheme('light')}
          >
            ☀️ Hell
          </button>
          <button
            className={theme === 'dark' ? 'active' : ''}
            onClick={() => setTheme('dark')}
          >
            🌙 Dunkel
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Verwaltung</h3>
        <div className="stack">
          <Link to="/kategorien" className="btn btn-block">
            🏷️ Kategorien verwalten
          </Link>
          <Link to="/regeln" className="btn btn-block">
            🪄 Auto-Kategorisierung (Regeln)
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Daten sichern</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Deine Daten liegen ausschließlich auf diesem Gerät. Sichere sie
          regelmäßig als Datei – so kannst du sie auf ein anderes Gerät übertragen
          oder wiederherstellen.
        </p>
        <div className="stack">
          <button className="btn btn-block" onClick={() => exportBackup()}>
            ⬇️ Backup exportieren
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImport(f)
            }}
          />
          <button
            className="btn btn-block"
            onClick={() => importRef.current?.click()}
          >
            ⬆️ Backup importieren
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Auf dem iPhone installieren</h3>
        <p className="hint" style={{ marginTop: 0, marginBottom: 0 }}>
          Öffne diese Seite in <strong>Safari</strong>, tippe auf das
          Teilen-Symbol <strong>􀈂</strong> und wähle{' '}
          <strong>„Zum Home-Bildschirm"</strong>. Danach startet die App wie eine
          native App im Vollbild – auch offline.
        </p>
      </div>

      <div className="card">
        <h3 className="card-title">Statistik</h3>
        <div className="row-between">
          <span className="muted">Buchungen</span>
          <strong>{txCount ?? 0}</strong>
        </div>
        <div className="row-between" style={{ marginTop: 6 }}>
          <span className="muted">Kategorien</span>
          <strong>{catCount ?? 0}</strong>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 className="card-title text-danger">Gefahrenzone</h3>
        <button className="btn btn-danger btn-block" onClick={handleWipe}>
          🗑️ Alle Daten löschen
        </button>
      </div>

      <p className="hint center" style={{ marginTop: 16 }}>
        Ausgabentracker · lokale PWA · v1.0
      </p>
    </>
  )
}
