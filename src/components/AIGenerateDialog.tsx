import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Loader2, Copy, Check, RotateCcw, AlertCircle, Download } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { useAppStore } from '../store'
import { generateSkill, type GenerateSkillEvent, installSkill, detectTools } from '../api/skillhub'
import { invoke } from '@tauri-apps/api/core'
import ToolSelector from './ToolSelector'

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

const CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'devops', label: 'DevOps' },
  { value: 'testing', label: 'Testing' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'ai-ml', label: 'AI/ML' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'security', label: 'Security' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'other', label: 'Other' },
]

export default function AIGenerateDialog({
  open,
  onClose,
  onApply,
  category,
}: AIGenerateDialogProps) {
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
      showToast('Please login to use AI generation', 'warning')
      return
    }

    if (description.trim().length < 10) {
      setError('Please describe your skill in more detail (at least 10 characters)')
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
              setError(event.message || 'Generation failed')
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
        setError(err instanceof Error ? err.message : 'Generation failed')
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
      showToast('Please select at least one tool', 'warning')
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
        showToast(`Installed "${skillName}" to project`, 'success')
      } else {
        // Install to personal (global) directory
        await installSkill(generatedContent, skillName, selectedToolIds)
        showToast(`Installed "${skillName}" to ${selectedToolIds.length} tool(s)`, 'success')
      }

      // Refresh tools to update counts
      const newTools = await detectTools()
      setTools(newTools)

      onClose()
    } catch (err) {
      console.error('Install failed:', err)
      showToast(err instanceof Error ? err.message : 'Install failed', 'error')
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
            <h2 className="text-lg font-semibold text-foreground">AI Skill Generator</h2>
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
                <p className="font-medium text-yellow-600 dark:text-yellow-400">Login required</p>
                <p className="text-yellow-700 dark:text-yellow-300/80">Please login to use AI skill generation. Free users get 1 generation per day.</p>
              </div>
            </div>
          )}

          {/* Input section */}
          {state === 'idle' && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Describe your skill *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., A skill that helps generate TypeScript React components with proper types and hooks..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none h-32 text-foreground placeholder:text-muted-foreground"
                  disabled={!isAuthenticated}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Be specific about what you want the skill to do, include examples if helpful.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Output Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-foreground"
                    disabled={!isAuthenticated}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-foreground"
                    disabled={!isAuthenticated}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
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
                      <span className="text-sm text-muted-foreground">Generating...</span>
                    </>
                  )}
                  {state === 'done' && (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Generation complete
                      {dailyRemaining !== null && (
                        <span className="text-muted-foreground font-normal ml-2">
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
                      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      <RotateCcw size={14} />
                      Regenerate
                    </button>
                  </div>
                )}
              </div>

              <div data-color-mode={theme} className="border border-border rounded-lg overflow-hidden">
                <MDEditor.Markdown
                  source={generatedContent || 'Waiting for content...'}
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
                <p className="font-medium text-red-600 dark:text-red-400">Error</p>
                <p className="text-red-700 dark:text-red-300/80">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-muted/50 rounded-b-xl">
          <p className="text-xs text-muted-foreground">
            Free users: 1/day | Pro users: 19/day
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {state === 'generating' ? 'Stop' : 'Cancel'}
            </button>
            {state === 'idle' && (
              <button
                onClick={handleGenerate}
                disabled={!isAuthenticated || description.trim().length < 10}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={16} />
                Generate
              </button>
            )}
            {state === 'done' && (
              <>
                <button
                  onClick={handleApply}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Apply to Editor
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
                  {installing ? 'Installing...' : 'Install Locally'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
