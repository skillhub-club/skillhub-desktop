import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Loader2, Copy, Check, RotateCcw, AlertCircle, Download } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { useAppStore } from '../store'
import { generateSkill, type GenerateSkillEvent, installSkill, detectTools } from '../api/skillhub'
import { invoke } from '@tauri-apps/api/core'
import ToolSelector from './ToolSelector'
import { useTranslation } from 'react-i18next'

interface AIGenerateDialogProps {
  open: boolean
  onClose: () => void
  onApply: (content: string, generationId: string) => void
  category?: string
}

type GenerationState = 'idle' | 'generating' | 'done' | 'error'

const LANGUAGES = [
  { value: 'en', labelKey: 'aiGenerate.languages.en' },
  { value: 'zh', labelKey: 'aiGenerate.languages.zh' },
]

const CATEGORIES = [
  { value: 'development', labelKey: 'aiGenerate.categories.development' },
  { value: 'devops', labelKey: 'aiGenerate.categories.devops' },
  { value: 'testing', labelKey: 'aiGenerate.categories.testing' },
  { value: 'documentation', labelKey: 'aiGenerate.categories.documentation' },
  { value: 'ai-ml', labelKey: 'aiGenerate.categories.aiMl' },
  { value: 'frontend', labelKey: 'aiGenerate.categories.frontend' },
  { value: 'backend', labelKey: 'aiGenerate.categories.backend' },
  { value: 'security', labelKey: 'aiGenerate.categories.security' },
  { value: 'productivity', labelKey: 'aiGenerate.categories.productivity' },
  { value: 'other', labelKey: 'aiGenerate.categories.other' },
]

export default function AIGenerateDialog({
  open,
  onClose,
  onApply,
  category,
}: AIGenerateDialogProps) {
  const { t } = useTranslation()
  const { 
    isAuthenticated, 
    accessToken, 
    showToast, 
    theme,
    selectedToolIds,
    installTarget,
    projectPath,
    setTools,
  } = useAppStore()

  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState('en')
  const [selectedCategory, setSelectedCategory] = useState(category || 'development')
  const [state, setState] = useState<GenerationState>('idle')
  const [generatedContent, setGeneratedContent] = useState('')
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [installing, setInstalling] = useState(false)

  const contentRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('')
      setLanguage('en')
      setSelectedCategory(category || 'development')
      setState('idle')
      setGeneratedContent('')
      setGenerationId(null)
      setError(null)
      contentRef.current = ''
    }
  }, [open, category])

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
      showToast(t('aiGenerate.loginRequiredToast'), 'warning')
      return
    }

    if (description.trim().length < 10) {
      setError(t('aiGenerate.describeTooShort'))
      return
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    setState('generating')
    setError(null)
    setGeneratedContent('')
    contentRef.current = ''

    try {
      await generateSkill(
        accessToken,
        {
          description: description.trim(),
          category: selectedCategory,
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
                // Handle case where text might be an object
                const textContent = typeof event.text === 'string' 
                  ? event.text 
                  : JSON.stringify(event.text)
                contentRef.current += textContent
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
              setError(event.message || t('aiGenerate.generationFailed'))
              break
          }
        },
        abortControllerRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setState('idle')
        setGeneratedContent('')
        contentRef.current = ''
      } else {
        setState('error')
        setError(err instanceof Error ? err.message : t('aiGenerate.generationFailed'))
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (state === 'generating' && abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setState('idle')
      setGeneratedContent('')
      contentRef.current = ''
    } else {
      onClose()
    }
  }

  const handleApply = () => {
    if (generatedContent && generationId) {
      onApply(generatedContent, generationId)
      onClose()
    }
  }

  // Extract skill name from generated content (from YAML frontmatter)
  const extractSkillName = (content: string): string => {
    const nameMatch = content.match(/^name:\s*["']?([^"'\n]+)["']?/m)
    if (nameMatch) {
      return nameMatch[1].trim()
    }
    // Fallback: use first few words of description
    return description.trim().split(/\s+/).slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'generated-skill'
  }

  const handleInstall = async () => {
    if (!generatedContent || selectedToolIds.length === 0) {
      showToast(t('aiGenerate.selectToolWarning'), 'warning')
      return
    }

    setInstalling(true)
    try {
      const skillName = extractSkillName(generatedContent)
      
      if (installTarget === 'project' && projectPath) {
        // Install to project directory
        for (const toolId of selectedToolIds) {
          await invoke('install_skill_to_project', {
            skillContent: generatedContent,
            skillName,
            projectPath,
            toolId,
          })
        }
        showToast(t('aiGenerate.installedToProject', { name: skillName }), 'success')
      } else {
        // Install to personal (global) directory
        await installSkill(generatedContent, skillName, selectedToolIds)
        showToast(t('aiGenerate.installedToTools', { name: skillName, count: selectedToolIds.length }), 'success')
      }

      // Refresh tools to update counts
      const newTools = await detectTools()
      setTools(newTools)

      onClose()
    } catch (err) {
      console.error('Install failed:', err)
      showToast(err instanceof Error ? err.message : t('aiGenerate.installFailed'), 'error')
    } finally {
      setInstalling(false)
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-foreground">{t('aiGenerate.title')}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Auth warning */}
          {!isAuthenticated && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">{t('common.loginRequired')}</p>
                <p className="text-yellow-700 dark:text-yellow-300/80">{t('aiGenerate.loginRequiredDesc')}</p>
              </div>
            </div>
          )}

          {/* Input section */}
          {state === 'idle' && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('aiGenerate.describeLabel')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('aiGenerate.describePlaceholder')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none h-32 text-foreground placeholder:text-muted-foreground"
                  disabled={!isAuthenticated}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('aiGenerate.describeHelp')}
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('aiGenerate.outputLanguage')}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-foreground"
                    disabled={!isAuthenticated}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {t(lang.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('aiGenerate.category')}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-foreground"
                    disabled={!isAuthenticated}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {t(cat.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Generating / Result section */}
          {(state === 'generating' || state === 'done') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {state === 'generating' && (
                    <>
                      <Loader2 className="animate-spin text-blue-500" size={18} />
                      <span className="text-sm text-muted-foreground">{t('aiGenerate.generating')}</span>
                    </>
                  )}
                  {state === 'done' && (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {t('aiGenerate.generationComplete')}
                      {dailyRemaining !== null && (
                        <span className="text-muted-foreground font-normal ml-2">
                          {t('aiGenerate.remainingToday', { count: dailyRemaining })}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {state === 'done' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('aiGenerate.copied') : t('aiGenerate.copy')}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      <RotateCcw size={14} />
                      {t('aiGenerate.regenerate')}
                    </button>
                  </div>
                )}
              </div>

              <div data-color-mode={theme} className="border border-border rounded-lg overflow-hidden">
                <MDEditor.Markdown
                  source={generatedContent || t('aiGenerate.waiting')}
                  style={{
                    padding: 16,
                    background: 'var(--secondary)',
                    minHeight: 150,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                />
              </div>

              {/* Install options - show after generation is complete */}
              {state === 'done' && (
                <div className="border-t border-border pt-4">
                  <ToolSelector showInstallTarget={true} />
                </div>
              )}
            </div>
          )}

          {/* Error section */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-medium text-red-600 dark:text-red-400">{t('common.error')}</p>
                <p className="text-red-700 dark:text-red-300/80">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-muted/50 rounded-b-xl">
          <p className="text-xs text-muted-foreground">
            {t('aiGenerate.quotaHint')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {state === 'generating' ? t('aiGenerate.stop') : t('common.cancel')}
            </button>
            {state === 'idle' && (
              <button
                onClick={handleGenerate}
                disabled={!isAuthenticated || description.trim().length < 10}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={16} />
                {t('aiGenerate.generate')}
              </button>
            )}
            {state === 'done' && (
              <>
                <button
                  onClick={handleApply}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {t('aiGenerate.applyToEditor')}
                </button>
                <button
                  onClick={handleInstall}
                  disabled={installing || selectedToolIds.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {installing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {installing ? t('aiGenerate.installing') : t('aiGenerate.installLocally')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
