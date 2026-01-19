import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, Loader2, Info, Maximize2, X, Sparkles } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { installSkill, detectTools, trackGeneration } from '../api/skillhub'
import ToolSelector from '../components/ToolSelector'
import AIGenerateDialog from '../components/AIGenerateDialog'
import AIEnhanceToolbar from '../components/AIEnhanceToolbar'

const CATEGORIES = [
  'development',
  'devops',
  'testing',
  'documentation',
  'ai-ml',
  'frontend',
  'backend',
  'security',
  'productivity',
  'other',
]

const SKILL_TEMPLATE = `---
name: "{name}"
description: "{description}"
author: "{author}"
category: "{category}"
---

# {name}

{description}

## Instructions

[Write detailed instructions for the AI here...]

## Examples

\`\`\`
// Example usage
\`\`\`

## Notes

- [Any additional notes or requirements]
`

export default function CreateSkill() {
  const { selectedToolIds, showToast, setTools, user, isAuthenticated, accessToken } = useAppStore()
  const { t } = useTranslation()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('development')
  const [content, setContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAIDialog, setShowAIDialog] = useState(false)

  // AI Enhance toolbar state
  const [showEnhanceToolbar, setShowEnhanceToolbar] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Track AI generation for analytics
  const generationIdRef = useRef<string | null>(null)
  const originalContentRef = useRef<string | null>(null)

  // Esc key to close fullscreen or enhance toolbar
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEnhanceToolbar) {
          setShowEnhanceToolbar(false)
        } else if (isFullscreen) {
          setIsFullscreen(false)
        }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isFullscreen, showEnhanceToolbar])

  // Handle text selection in editor
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      // No selection or just a cursor
      return
    }

    const text = selection.toString().trim()
    if (text.length < 3) return // Ignore very short selections

    // Find the textarea in the editor
    const container = editorContainerRef.current
    if (!container) return

    const textarea = container.querySelector('textarea')
    if (!textarea) return

    // Get the selection position for positioning the toolbar
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    setSelectedText(text)
    setSelectionRange({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    })
    setToolbarPosition({
      top: rect.top - containerRect.top - 10,
      left: rect.left - containerRect.left + rect.width / 2,
    })
    setShowEnhanceToolbar(true)
  }, [])

  const generateContent = useCallback(() => {
    const authorName = user?.name || user?.github_username || 'Anonymous'
    return SKILL_TEMPLATE
      .replace(/\{name\}/g, name || 'My Skill')
      .replace(/\{description\}/g, description || 'A custom skill')
      .replace(/\{author\}/g, authorName)
      .replace(/\{category\}/g, category)
  }, [name, description, category, user])

  // Handle applying enhanced text
  const handleEnhanceApply = useCallback((newText: string) => {
    if (!selectionRange) return

    const currentContent = content || generateContent()
    const newContent =
      currentContent.slice(0, selectionRange.start) +
      newText +
      currentContent.slice(selectionRange.end)

    setContent(newContent)
    setShowEnhanceToolbar(false)
    setSelectedText('')
    setSelectionRange(null)
  }, [selectionRange, content, generateContent])

  const handleGenerateTemplate = () => {
    setContent(generateContent())
  }

  // Handle AI generated content
  const handleAIApply = (generatedContent: string, generationId: string) => {
    setContent(generatedContent)
    generationIdRef.current = generationId
    originalContentRef.current = generatedContent

    // Try to extract name from frontmatter
    const nameMatch = generatedContent.match(/name:\s*["']?([^"'\n]+)["']?/i)
    if (nameMatch) {
      setName(nameMatch[1].trim())
    }

    // Try to extract description from frontmatter
    const descMatch = generatedContent.match(/description:\s*["']?([^"'\n]+)["']?/i)
    if (descMatch) {
      setDescription(descMatch[1].trim())
    }

    // Try to extract category from frontmatter
    const catMatch = generatedContent.match(/category:\s*["']?([^"'\n]+)["']?/i)
    if (catMatch) {
      const extractedCat = catMatch[1].trim().toLowerCase()
      if (CATEGORIES.includes(extractedCat)) {
        setCategory(extractedCat)
      }
    }
  }

  // Calculate modification ratio
  const calculateModificationRatio = (original: string, final: string): number => {
    if (!original || !final || original === final) return 0
    const maxLen = Math.max(original.length, final.length)
    let matches = 0
    const minLen = Math.min(original.length, final.length)
    for (let i = 0; i < minLen; i++) {
      if (original[i] === final[i]) matches++
    }
    return maxLen > 0 ? 1 - matches / maxLen : 0
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Please enter a skill name', 'warning')
      return
    }
    if (selectedToolIds.length === 0) {
      showToast('Please select at least one tool', 'warning')
      return
    }

    const skillContent = content.trim() || generateContent()

    setCreating(true)
    try {
      await installSkill(skillContent, name, selectedToolIds)
      showToast(`Created "${name}" in ${selectedToolIds.length} tool(s)`, 'success')

      // Track AI generation usage if applicable
      if (generationIdRef.current && accessToken && originalContentRef.current) {
        const modificationRatio = calculateModificationRatio(
          originalContentRef.current,
          skillContent
        )
        const eventType = modificationRatio > 0.1 ? 'modified' : 'used'

        try {
          await trackGeneration(accessToken, {
            generation_id: generationIdRef.current,
            event: eventType,
            data: {
              original_content: originalContentRef.current,
              final_content: skillContent,
              modification_ratio: modificationRatio,
              tool_used: selectedToolIds[0],
            },
          })
        } catch (trackError) {
          // Silently fail tracking - don't interrupt user flow
          console.error('Failed to track generation:', trackError)
        }
      }

      // Refresh tools to update skill counts
      const newTools = await detectTools()
      setTools(newTools)

      // Reset form
      setName('')
      setDescription('')
      setContent('')
      setCategory('development')
      generationIdRef.current = null
      originalContentRef.current = null
    } catch (error) {
      console.error('Create failed:', error)
      showToast('Failed to create skill. Please try again.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Skill</h1>
        <p className="text-gray-600">Create a custom skill for your AI coding tools</p>
      </div>

      {/* AI Generate Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <Sparkles className="text-purple-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-purple-800">
              <p className="font-medium mb-1">AI Skill Generator</p>
              <p>
                Describe what you want your skill to do, and our AI will help you create it.
                {!isAuthenticated && ' Login to get started.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAIDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium shrink-0"
          >
            <Sparkles size={16} />
            AI Generate
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">What is a Skill?</p>
            <p>
              Skills are markdown files that provide instructions to AI coding assistants.
              They help the AI understand how to perform specific tasks like code review,
              testing, documentation, and more.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Code Review Helper"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Short Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what this skill does"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', '/')}
                </option>
              ))}
            </select>
          </div>

          {/* Tool Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Install to Tools *
            </label>
            <ToolSelector />
          </div>
        </div>

        {/* Right Column - Content Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              SKILL.md Content
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateTemplate}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Generate Template
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                title="Fullscreen"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div
            ref={editorContainerRef}
            className="relative"
            data-color-mode="light"
            onMouseUp={handleTextSelection}
          >
            <MDEditor
              value={content || generateContent()}
              onChange={(val) => setContent(val || '')}
              height={320}
              preview="live"
              visibleDragbar={false}
            />

            {/* AI Enhance Floating Toolbar */}
            {showEnhanceToolbar && selectedText && (
              <div
                className="absolute z-50"
                style={{
                  top: toolbarPosition.top,
                  left: toolbarPosition.left,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <AIEnhanceToolbar
                  selectedText={selectedText}
                  onApply={handleEnhanceApply}
                  onClose={() => setShowEnhanceToolbar(false)}
                  context={content}
                />
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            {t('create.editorHelp')} {isAuthenticated && '• Select text for AI enhance options.'}
          </p>
        </div>
      </div>

      {/* Create Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || selectedToolIds.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save size={18} />
              Create Skill
            </>
          )}
        </button>
      </div>

      {/* Fullscreen Editor Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {name || 'New Skill'} - SKILL.md
              </h2>
              <button
                onClick={handleGenerateTemplate}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Generate Template
              </button>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Fullscreen Editor */}
          <div className="flex-1 overflow-hidden" data-color-mode="light">
            <MDEditor
              value={content || generateContent()}
              onChange={(val) => setContent(val || '')}
              height="100%"
              preview="live"
              visibleDragbar={false}
              style={{ height: '100%' }}
            />
          </div>
        </div>
      )}

      {/* AI Generate Dialog */}
      <AIGenerateDialog
        open={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onApply={handleAIApply}
        category={category}
      />
    </div>
  )
}
