import { useState } from 'react'
import { X, Download, CheckSquare, Square, Loader2 } from 'lucide-react'
import { useAppStore } from '../store'
import { smartInstallSkill, smartInstallSkillToProject, detectTools } from '../api/skillhub'
import type { SkillHubSkill } from '../types'
import ToolSelector from './ToolSelector'

interface BatchActionBarProps {
  skills: SkillHubSkill[]
  onClose: () => void
}

export default function BatchActionBar({ skills, onClose }: BatchActionBarProps) {
  const {
    selectedSkillIds,
    selectedToolIds,
    installTarget,
    projectPath,
    clearSkillSelection,
    selectAllSkills,
    setTools,
    showToast,
  } = useAppStore()

  const [installing, setInstalling] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  const selectedCount = selectedSkillIds.length
  const allSelected = selectedCount === skills.length && skills.length > 0

  const handleSelectAll = () => {
    if (allSelected) {
      clearSkillSelection()
    } else {
      selectAllSkills(skills.map(s => s.id))
    }
  }

  const handleBatchInstall = async () => {
    if (installing || selectedToolIds.length === 0) return

    if (installTarget === 'project' && !projectPath) {
      showToast('Please select a project folder first', 'warning')
      return
    }

    const selectedSkills = skills.filter(s => selectedSkillIds.includes(s.id))
    if (selectedSkills.length === 0) {
      showToast('No skills selected', 'warning')
      return
    }

    setInstalling(true)
    let successCount = 0
    let failCount = 0

    for (const skill of selectedSkills) {
      try {
        if (installTarget === 'project' && projectPath) {
          await smartInstallSkillToProject(skill, projectPath, selectedToolIds)
        } else {
          await smartInstallSkill(skill, selectedToolIds)
        }
        successCount++
      } catch (error) {
        console.error(`Failed to install ${skill.name}:`, error)
        failCount++
      }
    }

    // Refresh tools
    try {
      const newTools = await detectTools()
      setTools(newTools)
    } catch (e) {
      console.error('Failed to refresh tools:', e)
    }

    if (failCount === 0) {
      showToast(`Installed ${successCount} skill(s) successfully`, 'success')
    } else {
      showToast(`Installed ${successCount}, failed ${failCount}`, 'warning')
    }

    setInstalling(false)
    setShowInstallModal(false)
    clearSkillSelection()
    onClose()
  }

  if (selectedCount === 0) return null

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-lg shadow-2xl border border-background/20">
          {/* Selection info */}
          <div className="flex items-center gap-2 pr-3 border-r border-background/20">
            <button
              onClick={handleSelectAll}
              className="p-1 hover:bg-background/20 rounded transition-colors"
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>
            <span className="text-sm font-semibold whitespace-nowrap">
              {selectedCount} selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInstallModal(true)}
              disabled={installing}
              className="flex items-center gap-2 px-4 py-1.5 bg-background text-foreground text-sm font-semibold rounded hover:bg-background/90 transition-colors disabled:opacity-50"
            >
              {installing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {installing ? 'Installing...' : 'Install All'}
            </button>
          </div>

          {/* Close */}
          <button
            onClick={() => {
              clearSkillSelection()
              onClose()
            }}
            className="p-1.5 hover:bg-background/20 rounded transition-colors ml-1"
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Install Modal */}
      {showInstallModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="bg-background border-2 border-foreground w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-border-light">
              <div>
                <h2 className="text-xl font-bold tracking-tight">BATCH INSTALL</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedCount} skill(s) selected
                </p>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected skills preview */}
            <div className="p-4 border-b border-border-light">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Skills to install:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {skills
                  .filter(s => selectedSkillIds.includes(s.id))
                  .map(skill => (
                    <span
                      key={skill.id}
                      className="px-2 py-1 text-xs bg-secondary text-foreground rounded"
                    >
                      {skill.name}
                    </span>
                  ))}
              </div>
            </div>

            <div className="p-4">
              <ToolSelector showInstallTarget />
            </div>

            <div className="flex gap-3 p-4 border-t-2 border-border-light">
              <button
                onClick={() => setShowInstallModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchInstall}
                disabled={installing || selectedToolIds.length === 0}
                className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installing ? 'Installing...' : `Install ${selectedCount} Skills`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
