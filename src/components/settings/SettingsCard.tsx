/**
 * SettingsCard - Card container for settings rows
 */

import { ReactNode } from 'react'

export interface SettingsCardProps {
  children: ReactNode
  className?: string
}

export function SettingsCard({ children, className = '' }: SettingsCardProps) {
  return (
    <div className={`bg-secondary/30 rounded-[8px] shadow-minimal divide-y divide-border/30 ${className}`}>
      {children}
    </div>
  )
}
