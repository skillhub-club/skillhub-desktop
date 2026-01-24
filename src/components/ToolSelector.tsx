import { useState } from 'react'
import { Check, FolderOpen, Home, ChevronRight, Info } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'

interface ToolSelectorProps {
  onSelectionChange?: (selectedIds: string[]) => void
  compact?: boolean
  showInstallTarget?: boolean
}

// Tool descriptions for user reference
const TOOL_INFO: Record<string, { descKey: string; url: string }> = {
  'claude-code': {
    descKey: 'toolSelector.toolInfo.claudeCode',
    url: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code',
  },
  'cursor': {
    descKey: 'toolSelector.toolInfo.cursor',
    url: 'https://cursor.com',
  },
  'codex': {
    descKey: 'toolSelector.toolInfo.codex',
    url: 'https://github.com/openai/codex',
  },
  'opencode': {
    descKey: 'toolSelector.toolInfo.opencode',
    url: 'https://github.com/opencode-ai/opencode',
  },
  'gemini-cli': {
    descKey: 'toolSelector.toolInfo.geminiCli',
    url: 'https://github.com/google-gemini/gemini-cli',
  },
  'windsurf': {
    descKey: 'toolSelector.toolInfo.windsurf',
    url: 'https://codeium.com/windsurf',
  },
}

export default function ToolSelector({ onSelectionChange, compact = false, showInstallTarget = false }: ToolSelectorProps) {
  const { t } = useTranslation()
  const { 
    tools, 
    selectedToolIds, 
    toggleToolSelection,
    installTarget,
    projectPath,
    setInstallTarget,
    setProjectPath,
  } = useAppStore()
  const [selectingFolder, setSelectingFolder] = useState(false)

  const handleToggle = (toolId: string) => {
    toggleToolSelection(toolId)
    if (onSelectionChange) {
      const newSelection = selectedToolIds.includes(toolId)
        ? selectedToolIds.filter(id => id !== toolId)
        : [...selectedToolIds, toolId]
      onSelectionChange(newSelection)
    }
  }

  const installedTools = tools.filter(t => t.installed)

  if (installedTools.length === 0) {
    return (
      <div className="text-center py-2 text-muted-foreground text-sm">
        {t('toolSelector.noTools')}
      </div>
    )
  }

  // Compact horizontal layout with better contrast and info
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {installedTools.map(tool => {
            const isSelected = selectedToolIds.includes(tool.id)
            const info = TOOL_INFO[tool.id]
            return (
              <div key={tool.id} className="relative group">
                <label
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                    isSelected
                      ? 'bg-foreground text-background shadow-md'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(tool.id)}
                    className="hidden"
                  />
                  {/* Checkbox indicator */}
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-background border-background'
                      : 'border-current opacity-50'
                  }`}>
                    {isSelected && <Check size={10} className="text-foreground" strokeWidth={3} />}
                  </div>
                  <span className="font-medium">{tool.name}</span>
                </label>
                {/* Tooltip on hover */}
                {info && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 p-2.5 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                    <p className="font-medium mb-1">{tool.name}</p>
                    <p className="text-muted-foreground">{t(info.descKey)}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Info hint */}
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info size={12} />
          {t('toolSelector.hoverHint')}
        </p>
      </div>
    )
  }

  const handleSelectProjectFolder = async () => {
    setSelectingFolder(true)
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('toolSelector.selectProject'),
      })
      if (selected && typeof selected === 'string') {
        setProjectPath(selected)
        setInstallTarget('project')
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    } finally {
      setSelectingFolder(false)
    }
  }

  // Default vertical layout
  return (
    <div className="space-y-4">
      {/* Install Target Selection */}
      {showInstallTarget && (
        <div className="space-y-2">
          <p className="swiss-label">{t('toolSelector.installLocation')}</p>
          
          {/* Personal (Global) */}
          <button
            onClick={() => setInstallTarget('personal')}
            className={`w-full flex items-center gap-3 p-3 border-2 text-left transition-all ${
              installTarget === 'personal'
                ? 'border-foreground bg-secondary'
                : 'border-border-light hover:border-foreground'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              installTarget === 'personal'
                ? 'border-foreground bg-foreground'
                : 'border-muted-foreground'
            }`}>
              {installTarget === 'personal' && (
                <div className="w-2 h-2 rounded-full bg-background" />
              )}
            </div>
            <Home size={18} className="text-muted-foreground" />
            <div className="flex-1">
              <span className="font-bold text-foreground">{t('toolSelector.personal')}</span>
              <p className="text-xs text-muted-foreground">{t('toolSelector.personalDesc')}</p>
            </div>
          </button>
          
          {/* Project */}
          <button
            onClick={handleSelectProjectFolder}
            disabled={selectingFolder}
            className={`w-full flex items-center gap-3 p-3 border-2 text-left transition-all ${
              installTarget === 'project'
                ? 'border-foreground bg-secondary'
                : 'border-border-light hover:border-foreground'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              installTarget === 'project'
                ? 'border-foreground bg-foreground'
                : 'border-muted-foreground'
            }`}>
              {installTarget === 'project' && (
                <div className="w-2 h-2 rounded-full bg-background" />
              )}
            </div>
            <FolderOpen size={18} className="text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-foreground">{t('toolSelector.project')}</span>
              {projectPath ? (
                <p className="text-xs text-muted-foreground truncate">{projectPath}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('toolSelector.projectDesc')}</p>
              )}
            </div>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      )}

      {/* Tool Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="swiss-label">{t('toolSelector.selectTools')}</p>
          {installedTools.length > 1 && (
            <button
              onClick={() => {
                const { selectAllTools, selectedToolIds } = useAppStore.getState()
                const allSelected = installedTools.every(t => selectedToolIds.includes(t.id))
                if (allSelected) {
                  // Deselect all
                  installedTools.forEach(t => toggleToolSelection(t.id))
                } else {
                  // Select all
                  selectAllTools()
                }
              }}
              className="text-xs font-semibold text-foreground hover:underline"
            >
              {installedTools.every(t => selectedToolIds.includes(t.id)) 
                ? t('toolSelector.deselectAll') 
                : t('toolSelector.selectAll')}
            </button>
          )}
        </div>
        {installedTools.map(tool => (
          <label
            key={tool.id}
            className={`flex items-center gap-3 p-3 border-2 cursor-pointer transition-all ${
              selectedToolIds.includes(tool.id)
                ? 'border-foreground bg-secondary'
                : 'border-border-light hover:border-foreground'
            }`}
          >
            <div className={`w-5 h-5 border-2 flex items-center justify-center ${
              selectedToolIds.includes(tool.id)
                ? 'border-foreground bg-foreground'
                : 'border-muted-foreground'
            }`}>
              {selectedToolIds.includes(tool.id) && (
                <Check size={12} className="text-background" />
              )}
            </div>
            <input
              type="checkbox"
              checked={selectedToolIds.includes(tool.id)}
              onChange={() => handleToggle(tool.id)}
              className="hidden"
            />
            <div className="flex-1">
              <span className="font-bold text-foreground">{tool.name}</span>
              <span className="text-sm text-muted-foreground ml-2">
                {t('toolSelector.skillCount', { count: tool.skills_count })}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
