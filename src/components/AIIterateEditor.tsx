import { useState, useRef, useEffect } from 'react'
import { 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  RotateCcw, 
  History,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { enhanceText, type EnhanceTextEvent } from '../api/skillhub'

interface AIIterateEditorProps {
  content: string
  onApply: (newContent: string) => void
  onClose: () => void
}

interface HistoryEntry {
  content: string
  instruction: string
  timestamp: Date
}

type EditState = 'idle' | 'editing' | 'done'

const QUICK_ACTIONS = [
  { labelKey: 'aiIterate.quickActions.expand', instructionKey: 'aiIterate.quickActions.expandInstruction' },
  { labelKey: 'aiIterate.quickActions.simplify', instructionKey: 'aiIterate.quickActions.simplifyInstruction' },
  { labelKey: 'aiIterate.quickActions.addExamples', instructionKey: 'aiIterate.quickActions.addExamplesInstruction' },
  { labelKey: 'aiIterate.quickActions.improveStructure', instructionKey: 'aiIterate.quickActions.improveStructureInstruction' },
  { labelKey: 'aiIterate.quickActions.fixGrammar', instructionKey: 'aiIterate.quickActions.fixGrammarInstruction' },
  { labelKey: 'aiIterate.quickActions.translateEn', instructionKey: 'aiIterate.quickActions.translateEnInstruction' },
  { labelKey: 'aiIterate.quickActions.translateZh', instructionKey: 'aiIterate.quickActions.translateZhInstruction' },
]

export default function AIIterateEditor({ content, onApply, onClose }: AIIterateEditorProps) {
  const { t } = useTranslation()
  const { isAuthenticated, accessToken, showToast, theme } = useAppStore()

  const [currentContent, setCurrentContent] = useState(content)
  const [instruction, setInstruction] = useState('')
  const [state, setState] = useState<EditState>('idle')
  const [previewContent, setPreviewContent] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef<string>('')

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Save initial state to history
  useEffect(() => {
    if (history.length === 0 && content) {
      setHistory([{
        content,
        instruction: t('aiIterate.initialContent'),
        timestamp: new Date(),
      }])
    }
  }, [content, history.length, t])

  const handleEdit = async (editInstruction: string) => {
    if (!isAuthenticated || !accessToken) {
      showToast(t('aiIterate.loginRequired'), 'warning')
      return
    }

    if (!editInstruction.trim()) {
      showToast(t('aiIterate.enterInstruction'), 'warning')
      return
    }

    setState('editing')
    setPreviewContent('')
    contentRef.current = ''

    try {
      await enhanceText(
        accessToken,
        {
          text: currentContent,
          type: 'rewrite',
          context: editInstruction.trim(),
        },
        (event: EnhanceTextEvent) => {
          switch (event.type) {
            case 'content':
              if (event.text) {
                contentRef.current += event.text
                setPreviewContent(contentRef.current)
              }
              break
            case 'done':
              setState('done')
              break
            case 'error':
              setState('idle')
              showToast(event.message || t('aiIterate.editFailed'), 'error')
              break
          }
        }
      )
    } catch (err) {
      setState('idle')
      showToast(err instanceof Error ? err.message : t('aiIterate.editFailed'), 'error')
    }
  }

  const handleApplyEdit = () => {
    if (previewContent) {
      // Save to history
      setHistory(prev => [...prev, {
        content: previewContent,
        instruction: instruction || t('aiIterate.quickActionLabel'),
        timestamp: new Date(),
      }])
      setCurrentContent(previewContent)
      setPreviewContent('')
      setInstruction('')
      setState('idle')
    }
  }

  const handleRevert = () => {
    setPreviewContent('')
    setState('idle')
  }

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1)
      setHistory(newHistory)
      setCurrentContent(newHistory[newHistory.length - 1].content)
    }
  }

  const handleRestoreFromHistory = (entry: HistoryEntry) => {
    setCurrentContent(entry.content)
    setShowHistory(false)
  }

  const handleFinalApply = () => {
    onApply(currentContent)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEdit(instruction)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border-2 border-foreground w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground bg-secondary">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-500" size={20} />
            <h2 className="text-lg font-bold uppercase tracking-wider">{t('aiIterate.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-semibold transition-colors ${
                showHistory ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History size={14} />
              {t('aiIterate.historyCount', { count: history.length })}
            </button>
            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              title={t('aiIterate.undo')}
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Content Preview */}
            <div className="flex-1 overflow-auto p-4" data-color-mode={theme}>
              {state === 'editing' || state === 'done' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    {state === 'editing' ? (
                      <>
                        <Loader2 className="animate-spin text-purple-500" size={16} />
                        <span className="text-muted-foreground">{t('aiIterate.editing')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="text-green-500" size={16} />
                        <span className="text-green-600 font-medium">{t('aiIterate.editComplete')}</span>
                      </>
                    )}
                  </div>
                  <div className="border border-purple-300 rounded-lg overflow-hidden">
                    <MDEditor.Markdown
                      source={previewContent || t('aiIterate.processing')}
                      style={{ padding: 16, background: 'var(--secondary)', minHeight: 300 }}
                    />
                  </div>
                  {state === 'done' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApplyEdit}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition-colors"
                      >
                        <Check size={16} />
                        {t('aiIterate.acceptChanges')}
                      </button>
                      <button
                        onClick={handleRevert}
                        className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-foreground rounded transition-colors"
                      >
                        <X size={16} />
                        {t('aiIterate.discard')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full">
                  <MDEditor.Markdown
                    source={currentContent || t('aiIterate.noContent')}
                    style={{ background: 'transparent', minHeight: 300 }}
                  />
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {state === 'idle' && (
              <div className="border-t border-border px-4 py-3">
                <button
                  onClick={() => setShowQuickActions(!showQuickActions)}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
                >
                  {t('aiIterate.quickActionsTitle')}
                  {showQuickActions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showQuickActions && (
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map(action => (
                      <button
                        key={action.labelKey}
                        onClick={() => {
                          const instructionText = t(action.instructionKey)
                          setInstruction(instructionText)
                          handleEdit(instructionText)
                        }}
                        className="px-3 py-1.5 text-xs font-semibold border border-border rounded hover:border-foreground hover:bg-secondary transition-colors"
                      >
                        {t(action.labelKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="border-t-2 border-foreground p-4 bg-secondary">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('aiIterate.inputPlaceholder')}
                  className="flex-1 px-4 py-3 bg-background border-2 border-border rounded-lg resize-none focus:border-foreground focus:outline-none text-sm"
                  rows={2}
                  disabled={state === 'editing'}
                />
                <button
                  onClick={() => handleEdit(instruction)}
                  disabled={state === 'editing' || !instruction.trim() || !isAuthenticated}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
                >
                  {state === 'editing' ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              {!isAuthenticated && (
                <p className="text-xs text-yellow-600 mt-2">
                  {t('aiIterate.loginRequired')}
                </p>
              )}
            </div>
          </div>

          {/* History Panel */}
          {showHistory && (
            <div className="w-64 border-l-2 border-foreground overflow-y-auto bg-secondary">
              <div className="p-3 border-b border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('aiIterate.editHistory')}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {history.slice().reverse().map((entry, index) => (
                  <button
                    key={index}
                    onClick={() => handleRestoreFromHistory(entry)}
                    className="w-full p-3 text-left hover:bg-background transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {entry.instruction}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {entry.timestamp.toLocaleTimeString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t-2 border-foreground bg-secondary">
          <p className="text-xs text-muted-foreground">
            {t('aiIterate.footerHint')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleFinalApply}
              disabled={state === 'editing'}
              className="px-4 py-2 bg-foreground text-background font-semibold rounded hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {t('aiIterate.applyToEditor')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
