/**
 * SettingsRow - A row in a settings card with label and content
 */

import { ReactNode } from 'react'

export interface SettingsRowProps {
  label: string
  description?: string
  children?: ReactNode
  action?: ReactNode
  onClick?: () => void
}

export function SettingsRow({ label, description, children, action, onClick }: SettingsRowProps) {
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between text-left px-4 py-3.5 ${
        onClick ? 'hover:bg-secondary/50 transition-colors cursor-pointer' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{description}</div>
        )}
      </div>
      {(children || action) && (
        <div className="flex items-center gap-3 ml-4 shrink-0">
          {children}
          {action}
        </div>
      )}
    </Component>
  )
}
