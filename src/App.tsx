import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { useSettings } from './hooks/data'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import AddExpense from './pages/AddExpense'
import Import from './pages/Import'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import Rules from './pages/Rules'

export default function App() {
  const settings = useSettings()

  // Theme auf das Wurzelelement anwenden.
  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [settings?.theme])

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transaktionen" element={<Transactions />} />
          <Route path="/erfassen" element={<AddExpense />} />
          <Route path="/import" element={<Import />} />
          <Route path="/mehr" element={<Settings />} />
          <Route path="/kategorien" element={<Categories />} />
          <Route path="/regeln" element={<Rules />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
