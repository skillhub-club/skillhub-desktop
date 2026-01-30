import { useTranslation } from 'react-i18next'
import { Check, ArrowDown, ArrowUp, AlertTriangle, Cloud } from 'lucide-react'

export type SyncStatus = 'in_sync' | 'local_changes' | 'remote_changes' | 'conflict' | 'not_synced'

interface SyncStatusBadgeProps {
  status: SyncStatus
  compact?: boolean
}

const statusConfig: Record<SyncStatus, {
  icon: typeof Check
  colorClass: string
  bgClass: string
  i18nKey: string
}> = {
  in_sync: {
    icon: Check,
    colorClass: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
    i18nKey: 'mySkills.status.inSync',
  },
  local_changes: {
    icon: ArrowUp,
    colorClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
    i18nKey: 'mySkills.status.localChanges',
  },
  remote_changes: {
    icon: ArrowDown,
    colorClass: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
    i18nKey: 'mySkills.status.remoteChanges',
  },
  conflict: {
    icon: AlertTriangle,
    colorClass: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
    i18nKey: 'mySkills.status.conflict',
  },
  not_synced: {
    icon: Cloud,
    colorClass: 'text-gray-500 dark:text-gray-400',
    bgClass: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
    i18nKey: 'mySkills.status.notSynced',
  },
}

export default function SyncStatusBadge({ status, compact }: SyncStatusBadgeProps) {
  const { t } = useTranslation()
  const config = statusConfig[status]
  const Icon = config.icon

  if (compact) {
    return (
      <span
        className={`inline-flex items-center ${config.colorClass}`}
        title={t(config.i18nKey)}
      >
        <Icon size={14} />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border ${config.bgClass} ${config.colorClass}`}
    >
      <Icon size={12} />
      {t(config.i18nKey)}
    </span>
  )
}
