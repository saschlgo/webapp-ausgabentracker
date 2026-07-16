import { NavLink } from 'react-router-dom'

interface NavConfig {
  to: string
  label: string
  icon: string
  className?: string
  end?: boolean
}

const ITEMS: NavConfig[] = [
  { to: '/', label: 'Übersicht', icon: '📊', end: true },
  { to: '/transaktionen', label: 'Buchungen', icon: '📃' },
  { to: '/erfassen', label: 'Neu', icon: '＋', className: 'nav-add' },
  { to: '/import', label: 'Import', icon: '📥' },
  { to: '/mehr', label: 'Mehr', icon: '⚙️' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            ['nav-item', item.className, isActive ? 'active' : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
