import { useState, useEffect } from 'react'
import { X, Loader2, Check, Download } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'

interface InstalledSkill {
  name: string
  path: string
  description?: string
  author?: string
  tool_id: string
}

interface ImportSkillsModalProps {
  sourcePath: string  // Personal skills path (e.g., ~/.claude/skills)
  destPath: string    // Project skills path (e.g., /project/.claude/skills)
  toolName: string
  onClose: () => void
  onImported: () => void
}

export default function ImportSkillsModal({
  sourcePath,
  destPath,
  toolName,
  onClose,
  onImported
}: ImportSkillsModalProps) {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<InstalledSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Load personal skills
  useEffect(() => {
    setLoading(true)
    invoke<InstalledSkill[]>('list_skills_in_dir', { dirPath: sourcePath })
      .then(data => {
        setSkills(data)
        setError(null)
      })
      .catch(err => {
        console.error('Failed to load skills:', err)
        setError(t('importSkills.failedToLoad'))
      })
      .finally(() => setLoading(false))
  }, [sourcePath])

  const toggleSkill = (path: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedSkills.size === skills.length) {
      setSelectedSkills(new Set())
    } else {
      setSelectedSkills(new Set(skills.map(s => s.path)))
    }
  }

  const handleImport = async () => {
    if (selectedSkills.size === 0) return

    setImporting(true)
    setImportedCount(0)
    setError(null)

    let successCount = 0
    const errors: string[] = []

    for (const skillPath of selectedSkills) {
      try {
        await invoke('copy_skill', { sourcePath: skillPath, destDir: destPath })
        successCount++
        setImportedCount(successCount)
      } catch (err) {
        const skill = skills.find(s => s.path === skillPath)
        errors.push(`${skill?.name || skillPath}: ${err}`)
      }
    }

    setImporting(false)

    if (successCount > 0) {
      onImported()
    }

    if (errors.length > 0) {
      setError(`${t('importSkills.someImportsFailed')}\n${errors.join('\n')}`)
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border-2 border-foreground w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-border-light">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{t('importSkills.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('importSkills.toolSkills', { tool: toolName })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-foreground" size={24} />
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('importSkills.noSkills')}</p>
              <p className="text-sm mt-1">{sourcePath}</p>
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-light">
                <span className="text-sm text-muted-foreground">
                  {t('importSkills.selectedCount', { selected: selectedSkills.size, total: skills.length })}
                </span>
                <button
                  onClick={toggleAll}
                  className="text-sm font-semibold text-foreground hover:underline"
                >
                  {selectedSkills.size === skills.length ? t('importSkills.deselectAll') : t('importSkills.selectAll')}
                </button>
              </div>

              {/* Skills list */}
              <div className="space-y-2">
                {skills.map(skill => (
                  <button
                    key={skill.path}
                    onClick={() => toggleSkill(skill.path)}
                    className={`w-full p-3 text-left border-2 transition-colors ${
                      selectedSkills.has(skill.path)
                        ? 'border-foreground bg-secondary'
                        : 'border-border-light hover:border-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 border-2 flex items-center justify-center ${
                        selectedSkills.has(skill.path)
                          ? 'border-foreground bg-foreground'
                          : 'border-muted-foreground'
                      }`}>
                        {selectedSkills.has(skill.path) && (
                          <Check size={14} className="text-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{skill.name}</h4>
                        {skill.description && (
                          <p className="text-sm text-muted-foreground truncate">{skill.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t-2 border-border-light">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleImport}
            disabled={importing || selectedSkills.size === 0}
            className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('importSkills.importing', { done: importedCount, total: selectedSkills.size })}
              </>
            ) : (
              <>
                <Download size={16} />
                {selectedSkills.size > 0
                  ? t('importSkills.importWithCount', { count: selectedSkills.size })
                  : t('importSkills.import')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
