import type { ReactNode } from 'react'

interface Props {
  emoji: string
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ emoji, title, description, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}
