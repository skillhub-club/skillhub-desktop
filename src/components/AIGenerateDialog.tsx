import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Loader2, Copy, Check, RotateCcw, AlertCircle } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { useAppStore } from '../store'
import { generateSkill, type GenerateSkillEvent } from '../api/skillhub'

interface AIGenerateDialogProps {
  open: boolean
  onClose: () => void
  onApply: (content: string, generationId: string) => void
  category?: string
}

type GenerationState = 'idle' | 'generating' | 'done' | 'error'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

export default function AIGenerateDialog({
  open,
  onClose,
  onApply,
  category,
}: AIGenerateDialogProps) {
  const { isAuthenticated, accessToken, setToastMessage } = useAppStore()

  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState('en')
  const [state, setState] = useState<GenerationState>('idle')
  const [generatedContent, setGeneratedContent] = useState('')
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const contentRef = useRef<string>('')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('')
      setLanguage('en')
      setState('idle')
      setGeneratedContent('')
      setGenerationId(null)
      setError(null)
      contentRef.current = ''
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && state !== 'generating') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, state, onClose])

  const handleGenerate = async () => {
    if (!isAuthenticated || !accessToken) {
      setToastMessage('Please login to use AI generation')
      return
    }

    if (description.trim().length < 10) {
      setError('Please describe your skill in more detail (at least 10 characters)')
      return
    }

    setState('generating')
    setError(null)
    setGeneratedContent('')
    contentRef.current = ''

    try {
      await generateSkill(
        accessToken,
        {
          description: description.trim(),
          category,
          context: {
            tool: 'claude',
            language,
          },
        },
        (event: GenerateSkillEvent) => {
          switch (event.type) {
            case 'start':
              setGenerationId(event.generation_id || null)
              break
            case 'content':
              if (event.text) {
                contentRef.current += event.text
                setGeneratedContent(contentRef.current)
              }
              break
            case 'done':
              setState('done')
              if (event.usage?.daily_remaining !== undefined) {
                setDailyRemaining(event.usage.daily_remaining)
              }
              break
            case 'error':
              setState('error')
              setError(event.message || 'Generation failed')
              break
          }
        }
      )
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleApply = () => {
    if (generatedContent && generationId) {
      onApply(generatedContent, generationId)
      onClose()
    }
  }

  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRegenerate = () => {
    handleGenerate()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">AI Skill Generator</h2>
          </div>
          <button
            onClick={onClose}
            disabled={state === 'generating'}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Auth warning */}
          {!isAuthenticated && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5\" size={18} />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Login required</p>
                <p>Please login to use AI skill generation. Free users get 1 generation per day.</p>
              </div>
            </div>
          )}

          {/* Input section */}
          {state === 'idle' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe your skill *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., A skill that helps generate TypeScript React components with proper types and hooks..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none h-32"
                  disabled={!isAuthenticated}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific about what you want the skill to do, include examples if helpful.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Output Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    disabled={!isAuthenticated}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                {category && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Generating / Result section */}
          {(state === 'generating' || state === 'done') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {state === 'generating' && (
                    <>
                      <Loader2 className="animate-spin text-purple-500" size={18} />
                      <span className="text-sm text-gray-600">Generating...</span>
                    </>
                  )}
                  {state === 'done' && (
                    <span className="text-sm text-green-600 font-medium">
                      Generation complete
                      {dailyRemaining !== null && (
                        <span className="text-gray-500 font-normal ml-2">
                          ({dailyRemaining} remaining today)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {state === 'done' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <RotateCcw size={14} />
                      Regenerate
                    </button>
                  </div>
                )}
              </div>

              <div data-color-mode="light" className="border border-gray-200 rounded-lg overflow-hidden">
                <MDEditor.Markdown
                  source={generatedContent || 'Waiting for content...'}
                  style={{
                    padding: 16,
                    background: '#f9fafb',
                    minHeight: 200,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                />
              </div>
            </div>
          )}

          {/* Error section */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-red-800">
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500">
            Free users: 1/day | Pro users: Unlimited
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={state === 'generating'}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            {state === 'idle' && (
              <button
                onClick={handleGenerate}
                disabled={!isAuthenticated || description.trim().length < 10}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                Generate
              </button>
            )}
            {state === 'done' && (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Apply to Editor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
