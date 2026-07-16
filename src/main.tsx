import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ensureSeeded } from './db/db'
import './styles/global.css'

// Standardkategorien beim ersten Start anlegen.
ensureSeeded().catch((err) => console.error('Seed fehlgeschlagen:', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
