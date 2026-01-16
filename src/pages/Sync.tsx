import { useState } from 'react'
import { RefreshCw, ArrowRight, Loader2 } from 'lucide-react'
import { useAppStore } from '../store'
import { detectTools, getInstalledSkills, readSkillContent, installSkill } from '../api/skillhub'
import type { InstalledSkill } from '../types'

export default function Sync() {
  const { tools, setTools, setToastMessage } = useAppStore()

  const [syncing, setSyncing] = useState(false)
  const [sourceTool, setSourceTool] = useState<string>('')
  const [targetTools, setTargetTools] = useState<string[]>([])
  const [sourceSkills, setSourceSkills] = useState<InstalledSkill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())

  const installedTools = tools.filter(t => t.installed)

  const handleSourceChange = async (toolId: string) => {
    setSourceTool(toolId)
    setSourceSkills([])
    setSelectedSkills(new Set())

    if (toolId) {
      try {
        const skills = await getInstalledSkills(toolId)
        setSourceSkills(skills)
        setSelectedSkills(new Set(skills.map(s => s.path)))
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
        setToastMessage(`Synced ${syncedCount} skills, ${failedCount} failed`)
      } else {
        setToastMessage(`Synced ${syncedCount} skills to ${targetTools.length} tool(s)`)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setToastMessage('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sync Skills</h1>
        <p className="text-gray-600">Copy skills from one tool to another</p>
      </div>

      {installedTools.length < 2 ? (
        <div className="text-center py-20">
          <RefreshCw className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">You need at least 2 tools installed to sync</p>
          <p className="text-sm text-gray-400 mt-2">
            Currently detected: {installedTools.map(t => t.name).join(', ') || 'None'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Source Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Source Tool</h2>
            <div className="space-y-2">
              {installedTools.map(tool => (
                <label
                  key={tool.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    sourceTool === tool.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    checked={sourceTool === tool.id}
                    onChange={() => handleSourceChange(tool.id)}
                    className="text-primary-600"
                  />
                  <span className="font-medium">{tool.name}</span>
                  <span className="text-sm text-gray-500">
                    ({tool.skills_count} skills)
                  </span>
                </label>
              ))}
            </div>

            {/* Skills to sync */}
            {sourceSkills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Select skills to sync:</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {sourceSkills.map(skill => (
                    <label
                      key={skill.path}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkills.has(skill.path)}
                        onChange={() => toggleSkill(skill.path)}
                        className="text-primary-600 rounded"
                      />
                      <span className="text-sm truncate">{skill.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowRight className="text-gray-300" size={48} />
          </div>

          {/* Target Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Target Tools</h2>
            <div className="space-y-2">
              {installedTools
                .filter(t => t.id !== sourceTool)
                .map(tool => (
                  <label
                    key={tool.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      targetTools.includes(tool.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={targetTools.includes(tool.id)}
                      onChange={() => toggleTarget(tool.id)}
                      className="text-primary-600 rounded"
                    />
                    <span className="font-medium">{tool.name}</span>
                    <span className="text-sm text-gray-500">
                      ({tool.skills_count} skills)
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Sync Button */}
      {installedTools.length >= 2 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleSync}
            disabled={syncing || !sourceTool || targetTools.length === 0 || selectedSkills.size === 0}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={20} />
                Sync {selectedSkills.size} Skills to {targetTools.length} Tool(s)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
