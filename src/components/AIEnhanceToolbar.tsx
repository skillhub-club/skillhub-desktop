import { useState, useRef } from 'react'
import { Sparkles, Maximize2, MinusCircle, PenLine, Languages, Loader2, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { enhanceText, type EnhanceType, type EnhanceTextEvent } from '../api/skillhub'

interface AIEnhanceToolbarProps {
  selectedText: string
  onApply: (newText: string) => void
  onClose: () => void
  context?: string // Surrounding content for context
}

type EnhanceState = 'idle' | 'enhancing' | 'done' | 'error'

const ENHANCE_OPTIONS: { type: EnhanceType; icon: typeof Sparkles; labelKey: string; descKey: string }[] = [
  { type: 'expand', icon: Maximize2, labelKey: 'aiEnhance.expand', descKey: 'aiEnhance.expandDesc' },
  { type: 'simplify', icon: MinusCircle, labelKey: 'aiEnhance.simplify', descKey: 'aiEnhance.simplifyDesc' },
  { type: 'rewrite', icon: PenLine, labelKey: 'aiEnhance.rewrite', descKey: 'aiEnhance.rewriteDesc' },
  { type: 'translate', icon: Languages, labelKey: 'aiEnhance.translate', descKey: 'aiEnhance.translateDesc' },
]

export default function AIEnhanceToolbar({
  selectedText,
  onApply,
  onClose,
  context,
}: AIEnhanceToolbarProps) {
  const { t } = useTranslation()
  const { isAuthenticated, accessToken, showToast } = useAppStore()

  const [state, setState] = useState<EnhanceState>('idle')
  const [enhancedText, setEnhancedText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const enhancedTextRef = useRef('')

  const handleEnhance = async (type: EnhanceType) => {
    if (!isAuthenticated || !accessToken) {
      showToast(t('common.loginRequired'), 'warning')
      return
    }

    setState('enhancing')
    setError(null)
    setEnhancedText('')
    enhancedTextRef.current = ''

    try {
      await enhanceText(
        accessToken,
        {
          text: selectedText,
          type,
          context,
        },
        (event: EnhanceTextEvent) => {
          switch (event.type) {
            case 'content':
              if (event.text) {
                enhancedTextRef.current += event.text
                setEnhancedText(enhancedTextRef.current)
              }
              break
            case 'done':
              setState('done')
              break
            case 'error':
              setState('error')
              setError(event.message || 'Enhancement failed')
              break
          }
        }
      )
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Enhancement failed')
    }
  }

  const handleApply = () => {
    if (enhancedText) {
      onApply(enhancedText)
    }
  }

  const handleDiscard = () => {
    setState('idle')
    setEnhancedText('')
    enhancedTextRef.current = ''
    setError(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[280px] max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-500" size={16} />
          <span className="text-sm font-medium text-gray-700">AI Enhance</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X size={14} />
        </button>
      </div>

      {/* Idle state - show options */}
      {state === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          {ENHANCE_OPTIONS.map(({ type, icon: Icon, labelKey, descKey }) => (
            <button
              key={type}
              onClick={() => handleEnhance(type)}
              disabled={!isAuthenticated}
              className="flex items-center gap-2 p-2 text-left rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Icon size={16} className="text-purple-500" />
              <div>
                <div className="text-sm font-medium text-gray-700">{t(labelKey)}</div>
                <div className="text-xs text-gray-500">{t(descKey)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Enhancing state */}
      {state === 'enhancing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <Loader2 className="animate-spin" size={14} />
            <span>{t('aiEnhance.enhancing')}</span>
          </div>
          {enhancedText && (
            <div className="p-2 bg-gray-50 rounded text-sm text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {enhancedText}
            </div>
          )}
        </div>
      )}

      {/* Done state */}
      {state === 'done' && (
        <div className="space-y-2">
          <div className="p-2 bg-green-50 rounded text-sm text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap border border-green-200">
            {enhancedText}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              <X size={14} />
              {t('aiEnhance.discard')}
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              <Check size={14} />
              {t('aiEnhance.apply')}
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="space-y-2">
          <div className="p-2 bg-red-50 rounded text-sm text-red-700 border border-red-200">
            {error}
          </div>
          <button
            onClick={handleDiscard}
            className="w-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Auth warning */}
      {!isAuthenticated && state === 'idle' && (
        <p className="mt-2 text-xs text-gray-500 text-center">
          {t('common.loginRequired')}
        </p>
      )}
    </div>
  )
}
