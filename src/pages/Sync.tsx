import { useState, useEffect } from 'react'
import { RefreshCw, ArrowRight, ArrowLeftRight, Loader2, CheckSquare, Square, AlertTriangle, Check, X, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { detectTools, getInstalledSkills, readSkillContent, installSkill } from '../api/skillhub'
import ToolIcon from '../components/ToolIcon'
import type { InstalledSkill } from '../types'

type SyncMode = 'copy' | 'compare'

interface SkillConflict {
  skill: InstalledSkill
  existsIn: string[] // tool ids where this skill already exists
}

export default function Sync() {
  const { t } = useTranslation()
  const { tools, setTools, showToast } = useAppStore()

  const [mode, setMode] = useState<SyncMode>('copy')
  const [syncing, setSyncing] = useState(false)
  const [sourceTool, setSourceTool] = useState<string>('')
  const [targetTools, setTargetTools] = useState<string[]>([])
  const [sourceSkills, setSourceSkills] = useState<InstalledSkill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  
  // For comparison mode
  const [compareTool, setCompareTool] = useState<string>('')
  const [compareSkills, setCompareSkills] = useState<InstalledSkill[]>([])
  
  // For preview and conflict detection
  const [showPreview, setShowPreview] = useState(false)
  const [conflicts, setConflicts] = useState<SkillConflict[]>([])
  const [targetSkillsMap, setTargetSkillsMap] = useState<Record<string, InstalledSkill[]>>({})
  const [loadingTargets, setLoadingTargets] = useState(false)

  const installedTools = tools.filter(t => t.installed)
  
  // Select/deselect all skills
  const selectAllSkills = () => {
    setSelectedSkills(new Set(sourceSkills.map(s => s.path)))
  }
  
  const deselectAllSkills = () => {
    setSelectedSkills(new Set())
  }
  
  // Select/deselect all target tools
  const selectAllTargets = () => {
    setTargetTools(installedTools.filter(t => t.id !== sourceTool).map(t => t.id))
  }
  
  const deselectAllTargets = () => {
    setTargetTools([])
  }
  
  const isAllSkillsSelected = sourceSkills.length > 0 && selectedSkills.size === sourceSkills.length
  const availableTargets = installedTools.filter(t => t.id !== sourceTool)
  const isAllTargetsSelected = availableTargets.length > 0 && targetTools.length === availableTargets.length

  const handleSourceChange = async (toolId: string) => {
    setSourceTool(toolId)
    setSourceSkills([])
    setSelectedSkills(new Set())
    setConflicts([])
    setShowPreview(false)

    if (toolId) {
      try {
        const skills = await getInstalledSkills(toolId)
        setSourceSkills(skills)
        setSelectedSkills(new Set(skills.map(s => s.path)))
      } catch (error) {
        console.error('Failed to load skills:', error)
        showToast(t('sync.failedToLoadSkills'), 'error')
      }
    }
  }

  // Load target tools' skills when targets change (for conflict detection)
  useEffect(() => {
    const loadTargetSkills = async () => {
      if (targetTools.length === 0) {
        setTargetSkillsMap({})
        setConflicts([])
        return
      }

      setLoadingTargets(true)
      const skillsMap: Record<string, InstalledSkill[]> = {}
      
      for (const toolId of targetTools) {
        try {
          const skills = await getInstalledSkills(toolId)
          skillsMap[toolId] = skills
        } catch (error) {
          console.error(`Failed to load skills for ${toolId}:`, error)
          skillsMap[toolId] = []
        }
      }
      
      setTargetSkillsMap(skillsMap)
      setLoadingTargets(false)
    }

    loadTargetSkills()
  }, [targetTools])

  // Detect conflicts when source skills or target skills change
  useEffect(() => {
    if (sourceSkills.length === 0 || Object.keys(targetSkillsMap).length === 0) {
      setConflicts([])
      return
    }

    const newConflicts: SkillConflict[] = []
    
    for (const skill of sourceSkills) {
      if (!selectedSkills.has(skill.path)) continue
      
      const existsIn: string[] = []
      for (const [toolId, skills] of Object.entries(targetSkillsMap)) {
        // Check if a skill with the same name exists
        if (skills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
          existsIn.push(toolId)
        }
      }
      
      if (existsIn.length > 0) {
        newConflicts.push({ skill, existsIn })
      }
    }
    
    setConflicts(newConflicts)
  }, [sourceSkills, targetSkillsMap, selectedSkills])

  // Load compare tool skills
  const handleCompareToolChange = async (toolId: string) => {
    setCompareTool(toolId)
    setCompareSkills([])
    
    if (toolId) {
      try {
        const skills = await getInstalledSkills(toolId)
        setCompareSkills(skills)
      } catch (error) {
        console.error('Failed to load skills:', error)
      }
    }
  }

  const toggleTarget = (toolId: string) => {
    setTargetTools(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    )
    setShowPreview(false)
  }

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
    setShowPreview(false)
  }

  const handlePreview = () => {
    setShowPreview(true)
  }

  const handleSync = async () => {
    if (!sourceTool || targetTools.length === 0 || selectedSkills.size === 0) return

    setSyncing(true)
    let syncedCount = 0
    let failedCount = 0

    try {
      const skillsToSync = sourceSkills.filter(s => selectedSkills.has(s.path))

      for (const skill of skillsToSync) {
        try {
          // Read skill content from source
          const content = await readSkillContent(skill.path)

          // Install to all target tools
          await installSkill(content, skill.name, targetTools)
          syncedCount++
        } catch (error) {
          console.error(`Failed to sync skill ${skill.name}:`, error)
          failedCount++
        }
      }

      // Refresh tools to update skill counts
      const newTools = await detectTools()
      setTools(newTools)

      if (failedCount > 0) {
        showToast(t('sync.syncPartial', { synced: syncedCount, failed: failedCount }), 'warning')
      } else {
        showToast(t('sync.syncSuccess', { count: syncedCount, tools: targetTools.length }), 'success')
      }
      
      setShowPreview(false)
    } catch (error) {
      console.error('Sync failed:', error)
      showToast(t('sync.syncFailed'), 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Get comparison data
  const getComparisonData = () => {
    if (!sourceTool || !compareTool) return { onlyInSource: [], onlyInCompare: [], inBoth: [] }
    
    const sourceNames = new Set(sourceSkills.map(s => s.name.toLowerCase()))
    const compareNames = new Set(compareSkills.map(s => s.name.toLowerCase()))
    
    const onlyInSource = sourceSkills.filter(s => !compareNames.has(s.name.toLowerCase()))
    const onlyInCompare = compareSkills.filter(s => !sourceNames.has(s.name.toLowerCase()))
    const inBoth = sourceSkills.filter(s => compareNames.has(s.name.toLowerCase()))
    
    return { onlyInSource, onlyInCompare, inBoth }
  }

  const comparison = getComparisonData()
  const getToolName = (toolId: string) => installedTools.find(t => t.id === toolId)?.name || toolId

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">{t('sync.title').toUpperCase()}</h1>
        <p className="text-muted-foreground">{t('sync.subtitle')}</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('copy')}
          className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors ${
            mode === 'copy'
              ? 'bg-foreground text-background'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          }`}
        >
          <ArrowRight size={18} />
          {t('sync.modeCopy')}
        </button>
        <button
          onClick={() => setMode('compare')}
          className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors ${
            mode === 'compare'
              ? 'bg-foreground text-background'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          }`}
        >
          <ArrowLeftRight size={18} />
          {t('sync.modeCompare')}
        </button>
      </div>

      {installedTools.length < 2 ? (
        <div className="text-center py-20">
          <RefreshCw className="mx-auto text-muted-foreground mb-4" size={48} />
          <p className="text-muted-foreground">{t('sync.needTwoTools')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('sync.currentlyDetected')}: {installedTools.map(t => t.name).join(', ') || t('sync.none')}
          </p>
        </div>
      ) : mode === 'copy' ? (
        /* Copy Mode */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Source Selection */}
            <div className="card p-4">
              <h2 className="swiss-label mb-4">{t('sync.sourceTools')}</h2>
              <div className="space-y-2">
                {installedTools.map(tool => (
                  <label
                    key={tool.id}
                    className={`flex items-center gap-3 p-3 border-2 cursor-pointer transition-colors ${
                      sourceTool === tool.id
                        ? 'border-foreground bg-secondary'
                        : 'border-border-light hover:border-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="source"
                      checked={sourceTool === tool.id}
                      onChange={() => handleSourceChange(tool.id)}
                      className="sr-only"
                    />
                    <ToolIcon toolId={tool.id} size={24} />
                    <span className="font-semibold flex-1">{tool.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {tool.skills_count}
                    </span>
                  </label>
                ))}
              </div>

              {/* Skills to sync */}
              {sourceSkills.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border-light">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">{t('sync.selectSkills')}:</p>
                    <button
                      onClick={isAllSkillsSelected ? deselectAllSkills : selectAllSkills}
                      className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
                    >
                      {isAllSkillsSelected ? (
                        <>
                          <Square size={14} />
                          {t('sync.deselectAll')}
                        </>
                      ) : (
                        <>
                          <CheckSquare size={14} />
                          {t('sync.selectAll')}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {sourceSkills.map(skill => (
                      <label
                        key={skill.path}
                        className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${
                          selectedSkills.has(skill.path) ? 'bg-secondary' : 'hover:bg-secondary/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkills.has(skill.path)}
                          onChange={() => toggleSkill(skill.path)}
                          className="sr-only"
                        />
                        {selectedSkills.has(skill.path) ? (
                          <CheckSquare size={16} className="text-foreground flex-shrink-0" />
                        ) : (
                          <Square size={16} className="text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{skill.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('sync.selectedSkillsCount', { count: selectedSkills.size, total: sourceSkills.length })}
                  </p>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <ArrowRight className="text-muted-foreground" size={48} />
            </div>

            {/* Target Selection */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="swiss-label">{t('sync.targetTools')}</h2>
                {availableTargets.length > 0 && (
                  <button
                    onClick={isAllTargetsSelected ? deselectAllTargets : selectAllTargets}
                    className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
                  >
                    {isAllTargetsSelected ? (
                      <>
                        <Square size={14} />
                        {t('sync.deselectAll')}
                      </>
                    ) : (
                      <>
                        <CheckSquare size={14} />
                        {t('sync.selectAll')}
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {availableTargets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t('sync.selectSourceFirst')}
                  </p>
                ) : (
                  availableTargets.map(tool => (
                    <label
                      key={tool.id}
                      className={`flex items-center gap-3 p-3 border-2 cursor-pointer transition-colors ${
                        targetTools.includes(tool.id)
                          ? 'border-foreground bg-secondary'
                          : 'border-border-light hover:border-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={targetTools.includes(tool.id)}
                        onChange={() => toggleTarget(tool.id)}
                        className="sr-only"
                      />
                      {targetTools.includes(tool.id) ? (
                        <CheckSquare size={20} className="text-foreground flex-shrink-0" />
                      ) : (
                        <Square size={20} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <ToolIcon toolId={tool.id} size={24} />
                      <span className="font-semibold flex-1">{tool.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {tool.skills_count}
                      </span>
                    </label>
                  ))
                )}
              </div>
              
              {/* Conflict Warning */}
              {conflicts.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-400">
                  <div className="flex items-center gap-2 text-yellow-700 font-semibold mb-2">
                    <AlertTriangle size={16} />
                    {t('sync.conflictsDetected', { count: conflicts.length })}
                  </div>
                  <ul className="text-sm text-yellow-600 space-y-1">
                    {conflicts.slice(0, 3).map(c => (
                      <li key={c.skill.path}>
                        "{c.skill.name}" {t('sync.existsIn')} {c.existsIn.map(getToolName).join(', ')}
                      </li>
                    ))}
                    {conflicts.length > 3 && (
                      <li>...{t('sync.andMore', { count: conflicts.length - 3 })}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Preview & Sync Buttons */}
          {installedTools.length >= 2 && sourceTool && targetTools.length > 0 && selectedSkills.size > 0 && (
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={handlePreview}
                disabled={loadingTargets}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition-colors"
              >
                <Eye size={20} />
                {t('sync.preview')}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || loadingTargets}
                className="flex items-center gap-2 px-6 py-3 bg-foreground text-background font-semibold hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {t('sync.syncing')}
                  </>
                ) : (
                  <>
                    <RefreshCw size={20} />
                    {t('sync.syncButton', { skills: selectedSkills.size, tools: targetTools.length })}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Preview Modal */}
          {showPreview && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-background border-2 border-foreground w-[90vw] max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground bg-secondary">
                  <h2 className="text-lg font-bold uppercase">{t('sync.previewTitle')}</h2>
                  <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-background">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('sync.previewDesc', { 
                      skills: selectedSkills.size, 
                      source: getToolName(sourceTool),
                      targets: targetTools.map(getToolName).join(', ')
                    })}
                  </p>
                  
                  {conflicts.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400">
                      <div className="flex items-center gap-2 text-yellow-700 font-semibold mb-2">
                        <AlertTriangle size={16} />
                        {t('sync.willOverwrite', { count: conflicts.length })}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {sourceSkills.filter(s => selectedSkills.has(s.path)).map(skill => {
                      const conflict = conflicts.find(c => c.skill.path === skill.path)
                      return (
                        <div key={skill.path} className={`p-3 border-2 ${conflict ? 'border-yellow-400 bg-yellow-50' : 'border-border-light'}`}>
                          <div className="flex items-center gap-2">
                            {conflict ? (
                              <AlertTriangle size={16} className="text-yellow-600" />
                            ) : (
                              <Check size={16} className="text-green-600" />
                            )}
                            <span className="font-semibold">{skill.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{skill.path}</p>
                          {conflict && (
                            <p className="text-xs text-yellow-600 mt-1">
                              {t('sync.existsIn')}: {conflict.existsIn.map(getToolName).join(', ')}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 px-4 py-3 border-t-2 border-foreground bg-secondary">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 text-foreground font-semibold hover:bg-background"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-foreground text-background font-semibold hover:bg-foreground/90"
                  >
                    {syncing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {t('sync.confirmSync')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Compare Mode */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tool A */}
            <div className="card p-4">
              <h2 className="swiss-label mb-4">{t('sync.toolA')}</h2>
              <div className="space-y-2">
                {installedTools.map(tool => (
                  <label
                    key={tool.id}
                    className={`flex items-center gap-3 p-3 border-2 cursor-pointer transition-colors ${
                      sourceTool === tool.id
                        ? 'border-foreground bg-secondary'
                        : 'border-border-light hover:border-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="toolA"
                      checked={sourceTool === tool.id}
                      onChange={() => handleSourceChange(tool.id)}
                      className="sr-only"
                    />
                    <ToolIcon toolId={tool.id} size={24} />
                    <span className="font-semibold flex-1">{tool.name}</span>
                    <span className="text-sm text-muted-foreground">{tool.skills_count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tool B */}
            <div className="card p-4">
              <h2 className="swiss-label mb-4">{t('sync.toolB')}</h2>
              <div className="space-y-2">
                {installedTools.filter(t => t.id !== sourceTool).map(tool => (
                  <label
                    key={tool.id}
                    className={`flex items-center gap-3 p-3 border-2 cursor-pointer transition-colors ${
                      compareTool === tool.id
                        ? 'border-foreground bg-secondary'
                        : 'border-border-light hover:border-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="toolB"
                      checked={compareTool === tool.id}
                      onChange={() => handleCompareToolChange(tool.id)}
                      className="sr-only"
                    />
                    <ToolIcon toolId={tool.id} size={24} />
                    <span className="font-semibold flex-1">{tool.name}</span>
                    <span className="text-sm text-muted-foreground">{tool.skills_count}</span>
                  </label>
                ))}
                {!sourceTool && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t('sync.selectToolAFirst')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Results */}
          {sourceTool && compareTool && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Only in Tool A */}
              <div className="card p-4">
                <h3 className="swiss-label mb-3 text-green-600">
                  {t('sync.onlyIn', { tool: getToolName(sourceTool) })} ({comparison.onlyInSource.length})
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {comparison.onlyInSource.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t('sync.noSkills')}</p>
                  ) : (
                    comparison.onlyInSource.map(skill => (
                      <div key={skill.path} className="p-2 bg-green-50 text-sm">
                        {skill.name}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* In Both */}
              <div className="card p-4">
                <h3 className="swiss-label mb-3">
                  {t('sync.inBoth')} ({comparison.inBoth.length})
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {comparison.inBoth.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t('sync.noSkills')}</p>
                  ) : (
                    comparison.inBoth.map(skill => (
                      <div key={skill.path} className="p-2 bg-secondary text-sm">
                        {skill.name}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Only in Tool B */}
              <div className="card p-4">
                <h3 className="swiss-label mb-3 text-blue-600">
                  {t('sync.onlyIn', { tool: getToolName(compareTool) })} ({comparison.onlyInCompare.length})
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {comparison.onlyInCompare.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t('sync.noSkills')}</p>
                  ) : (
                    comparison.onlyInCompare.map(skill => (
                      <div key={skill.path} className="p-2 bg-blue-50 text-sm">
                        {skill.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
