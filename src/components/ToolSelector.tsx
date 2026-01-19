import { useState } from 'react'
import { Check, FolderOpen, Home, ChevronRight } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'

interface ToolSelectorProps {
  onSelectionChange?: (selectedIds: string[]) => void
  compact?: boolean
  showInstallTarget?: boolean
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
        No AI coding tools detected
      </div>
    )
  }

  // Compact horizontal layout
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {installedTools.map(tool => (
          <label
            key={tool.id}
            className={`inline-flex items-center gap-2 px-3 py-1.5 border cursor-pointer transition-all text-sm ${
              selectedToolIds.includes(tool.id)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:border-foreground text-foreground'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedToolIds.includes(tool.id)}
              onChange={() => handleToggle(tool.id)}
              className="hidden"
            />
            {selectedToolIds.includes(tool.id) && <Check size={12} />}
            <span className="font-medium">{tool.name}</span>
          </label>
        ))}
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
                ({tool.skills_count} skills)
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
