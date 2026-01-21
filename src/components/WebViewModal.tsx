import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'

interface WebViewModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  title?: string
  // Called when the URL changes (for detecting payment completion, etc.)
  onUrlChange?: (url: string) => void
  // Called when specific URL patterns are matched (e.g., success page)
  successUrlPattern?: RegExp
  onSuccess?: () => void
}

export default function WebViewModal({
  isOpen,
  onClose,
  url,
  title,
  onUrlChange,
  successUrlPattern,
  onSuccess,
}: WebViewModalProps) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
    }
  }, [isOpen, url])

  // Handle iframe load
  const handleLoad = () => {
    setLoading(false)
    
    // Try to get the current URL (may fail due to cross-origin)
    try {
      const currentUrl = iframeRef.current?.contentWindow?.location.href
      if (currentUrl && onUrlChange) {
        onUrlChange(currentUrl)
      }
      
      // Check for success pattern
      if (currentUrl && successUrlPattern && successUrlPattern.test(currentUrl)) {
        onSuccess?.()
      }
    } catch {
      // Cross-origin - can't access URL, which is expected
    }
  }

  // Handle iframe error
  const handleError = () => {
    setLoading(false)
    setError(t('webview.loadFailed'))
  }

  // Refresh iframe
  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    if (iframeRef.current) {
      iframeRef.current.src = url
    }
  }

  // Open in external browser
  const handleOpenExternal = async () => {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border-2 border-foreground w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground bg-secondary/30">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
              {title || t('webview.title')}
            </h2>
            {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title={t('common.refresh')}
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleOpenExternal}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title={t('webview.openExternal')}
            >
              <ExternalLink size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative bg-white">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('webview.loading')}</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-3 text-center p-6">
                <p className="text-sm text-red-500">{error}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 border-2 border-foreground text-foreground font-semibold text-sm uppercase tracking-wide hover:bg-secondary transition-colors"
                  >
                    {t('common.refresh')}
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    className="px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity"
                  >
                    {t('webview.openExternal')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* iframe */}
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            allow="payment"
          />
        </div>
      </div>
    </div>
  )
}
