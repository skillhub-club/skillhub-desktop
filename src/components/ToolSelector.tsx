import { Check } from 'lucide-react'
import { useAppStore } from '../store'

interface ToolSelectorProps {
  onSelectionChange?: (selectedIds: string[]) => void
}

export default function ToolSelector({ onSelectionChange }: ToolSelectorProps) {
  const { tools, selectedToolIds, toggleToolSelection } = useAppStore()

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
      <div className="text-center py-4 text-muted-foreground">
        No AI coding tools detected
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="swiss-label mb-2">Install to:</p>
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
  )
}
