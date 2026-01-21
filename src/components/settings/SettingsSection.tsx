/**
 * SettingsSection - Container for a group of related settings
 */

import { ReactNode } from 'react'

export interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}

export function SettingsSection({ title, description, children, action }: SettingsSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}
