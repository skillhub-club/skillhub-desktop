import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

const toastConfig: Record<ToastType, { icon: typeof CheckCircle; colorClass: string; bgClass: string }> = {
  success: {
    icon: CheckCircle,
    colorClass: 'text-green-400',
    bgClass: 'border-green-500/50',
  },
  error: {
    icon: AlertCircle,
    colorClass: 'text-red-400',
    bgClass: 'border-red-500/50',
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'text-yellow-400',
    bgClass: 'border-yellow-500/50',
  },
  info: {
    icon: Info,
    colorClass: 'text-blue-400',
    bgClass: 'border-blue-500/50',
  },
}

export default function Toast({
  message,
  type = 'success',
  onClose,
  duration = 3000,
  actionLabel,
  onAction,
}: ToastProps) {
  const { t } = useTranslation()
  const config = toastConfig[type]
  const Icon = config.icon

  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const handleAction = () => {
    if (onAction) {
      onAction()
    }
    onClose()
  }

  return (
    <div 
      className={`fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 border-2 ${config.bgClass} flex items-center gap-3 animate-slide-up`}
      role="alert"
      aria-live="polite"
    >
      <Icon size={18} className={config.colorClass} />
      <span className="font-semibold uppercase tracking-wider text-sm">{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={handleAction}
          className="px-2 py-1 border border-background/60 text-xs font-semibold rounded hover:bg-background hover:text-foreground transition-colors"
        >
          {actionLabel}
        </button>
      )}
      <button 
        onClick={onClose} 
        className="text-background/60 hover:text-background"
        aria-label={t('common.closeNotification')}
      >
        <X size={16} />
      </button>
    </div>
  )
}
