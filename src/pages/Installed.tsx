import { useState, useEffect } from 'react'
import { Trash2, FolderOpen, RefreshCw, Loader2 } from 'lucide-react'
import { useAppStore } from '../store'
import { getInstalledSkills, uninstallSkill, detectTools } from '../api/skillhub'
import type { InstalledSkill } from '../types'

export default function Installed() {
  const {
    tools,
    setTools,
    installedSkills,
    setInstalledSkills,
    setToastMessage,
  } = useAppStore()

  const [selectedTool, setSelectedTool] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [uninstalling, setUninstalling] = useState<string | null>(null)

  const installedTools = tools.filter(t => t.installed)

  // Set default selected tool
  useEffect(() => {
    if (installedTools.length > 0 && !selectedTool) {
      setSelectedTool(installedTools[0].id)
    }
  }, [installedTools, selectedTool])

  // Load skills when tool changes
  useEffect(() => {
    if (selectedTool) {
      setLoading(true)
      getInstalledSkills(selectedTool)
        .then(skills => setInstalledSkills(selectedTool, skills))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [selectedTool, setInstalledSkills])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const newTools = await detectTools()
      setTools(newTools)
      if (selectedTool) {
        const skills = await getInstalledSkills(selectedTool)
        setInstalledSkills(selectedTool, skills)
      }
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUninstall = async (skill: InstalledSkill) => {
    if (!confirm(`Are you sure you want to uninstall "${skill.name}"?`)) return

    setUninstalling(skill.path)
    try {
      await uninstallSkill(skill.path)
      // Refresh the list
      const skills = await getInstalledSkills(selectedTool)
      setInstalledSkills(selectedTool, skills)
      // Update tools count
      const newTools = await detectTools()
      setTools(newTools)
      setToastMessage(`Uninstalled "${skill.name}"`)
    } catch (error) {
      console.error('Uninstall failed:', error)
      setToastMessage('Uninstall failed. Please try again.')
    } finally {
      setUninstalling(null)
    }
  }

  const currentSkills = installedSkills[selectedTool] || []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Installed Skills</h1>
          <p className="text-gray-600">Manage skills installed on your system</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tool Tabs */}
      {installedTools.length > 0 ? (
        <>
          <div className="flex border-b border-gray-200 mb-6">
            {installedTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  selectedTool === tool.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tool.name}
                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                  {tool.skills_count}
                </span>
              </button>
            ))}
          </div>

          {/* Skills List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : currentSkills.length === 0 ? (
            <div className="text-center py-20">
              <FolderOpen className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">No skills installed for this tool</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentSkills.map(skill => (
                <div
                  key={skill.path}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                    {skill.description && (
                      <p className="text-sm text-gray-500 truncate">{skill.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 truncate">{skill.path}</p>
                  </div>
                  <button
                    onClick={() => handleUninstall(skill)}
                    disabled={uninstalling === skill.path}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Uninstall"
                  >
                    {uninstalling === skill.path ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <FolderOpen className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">No AI coding tools detected on your system</p>
          <p className="text-sm text-gray-400 mt-2">
            Install Claude Code, Cursor, or other supported tools to get started
          </p>
        </div>
      )}
    </div>
  )
}
