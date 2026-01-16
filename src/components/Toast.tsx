import { useEffect } from 'react'
import { X, CheckCircle } from 'lucide-react'

interface ToastProps {
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 border-2 border-foreground flex items-center gap-3 animate-slide-up">
      <CheckCircle size={18} className="text-green-400" />
      <span className="font-semibold uppercase tracking-wider text-sm">{message}</span>
      <button onClick={onClose} className="text-background/60 hover:text-background">
        <X size={16} />
      </button>
    </div>
  )
}
