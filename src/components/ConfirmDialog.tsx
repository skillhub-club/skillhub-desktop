import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const confirmLabel = confirmText || t('common.delete')
  const cancelLabel = cancelText || t('common.cancel')

  const confirmButtonClass = variant === 'danger'
    ? 'bg-red-600 text-white hover:bg-red-700'
    : variant === 'warning'
    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
    : 'bg-foreground text-background hover:bg-foreground/90'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-background border-2 border-foreground shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-border-light">
          <div className="flex items-center gap-3">
            {variant === 'danger' && (
              <AlertTriangle className="text-red-500" size={24} />
            )}
            {variant === 'warning' && (
              <AlertTriangle className="text-yellow-500" size={24} />
            )}
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-foreground">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t-2 border-border-light">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold border-2 border-border-light text-foreground hover:bg-secondary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
