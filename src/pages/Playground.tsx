import { useState, useEffect } from 'react'
import {
  RefreshCw, Wand2, Play, Search, PanelRightClose, PanelRight, Check
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import { detectTools } from '../api/skillhub'
import ToolIcon from '../components/ToolIcon'
import SkillPlayground from '../components/SkillPlayground'
import { buildProjectSkillsPath } from '../utils/toolPaths'

// Installed skill info for playground
type SkillSource = 'personal' | 'project'

interface InstalledSkill {
  name: string
  path: string
  content?: string
  source: SkillSource
}

interface ProjectInfo {
  path: string
  name: string
  toolId: string
}

// localStorage keys for persisting state
const STORAGE_KEYS = {
  selectedTool: 'skillhub_playground_tool',
  selectedSkills: 'skillhub_playground_skills',
  skillSources: 'skillhub_playground_sources',
  selectedProject: 'skillhub_playground_project',
  skillsPanelOpen: 'skillhub_skills_panel_open',
}

export default function Playground() {
  const { t } = useTranslation()
  const { tools, setTools, showToast } = useAppStore()

  // Load persisted state from localStorage
  const [selectedTool, setSelectedTool] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.selectedTool) || ''
  })
  const [refreshing, setRefreshing] = useState(false)
  const [skillsPanelOpen, setSkillsPanelOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.skillsPanelOpen)
    return saved !== 'false' // default open
  })

  // Skills state
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.selectedSkills)
      if (saved) {
        const parsed = JSON.parse(saved)
        return new Set(Array.isArray(parsed) ? parsed : [])
      }
    } catch { /* ignore */ }
    return new Set()
  })
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [skillSources, setSkillSources] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.skillSources)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch { /* ignore */ }
    return { personal: true, project: false }
  })
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedProjectPath, setSelectedProjectPath] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.selectedProject) || ''
  })

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.skillsPanelOpen, String(skillsPanelOpen))
  }, [skillsPanelOpen])

  useEffect(() => {
    if (selectedTool) {
      localStorage.setItem(STORAGE_KEYS.selectedTool, selectedTool)
    }
  }, [selectedTool])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.selectedSkills, JSON.stringify(Array.from(selectedSkillPaths)))
  }, [selectedSkillPaths])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.skillSources, JSON.stringify(skillSources))
  }, [skillSources])

  useEffect(() => {
    if (selectedProjectPath) {
      localStorage.setItem(STORAGE_KEYS.selectedProject, selectedProjectPath)
    }
  }, [selectedProjectPath])

  const installedTools = tools.filter(t => t.installed)
  const selectedToolData = tools.find(t => t.id === selectedTool)
  const activeSkills = installedSkills.filter(skill => selectedSkillPaths.has(skill.path))
  const toolProjects = projects.filter(project => project.toolId === selectedTool)

  // Set default selected tool
  useEffect(() => {
    if (installedTools.length > 0 && !selectedTool) {
      setSelectedTool(installedTools[0].id)
    }
  }, [installedTools, selectedTool])

  // Load projects from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('skillhub_projects')
    if (stored) {
      try {
        setProjects(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to parse projects:', error)
      }
    }
  }, [])

  // Load skills when tool changes (but keep previous selections if they still exist)
  useEffect(() => {
    if (selectedTool && selectedToolData) {
      loadInstalledSkills()
    }
  }, [selectedTool, selectedToolData])

  useEffect(() => {
    if (!skillSources.project) return
    if (toolProjects.length === 0) {
      setSelectedProjectPath('')
      return
    }
    if (!selectedProjectPath) {
      setSelectedProjectPath(toolProjects[0].path)
    }
  }, [skillSources.project, toolProjects, selectedProjectPath])

  const handleRefreshTools = async () => {
    setRefreshing(true)
    try {
      const newTools = await detectTools()
      setTools(newTools)
      await loadInstalledSkills()
      showToast(t('installed.refreshed'), 'success')
    } catch (error) {
      console.error('Refresh failed:', error)
      showToast(t('installed.refreshFailed'), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const collectSkills = async (skillsPath: string, source: SkillSource) => {
    try {
      const tree = await invoke<{ children?: Array<{ name: string; path: string; is_dir: boolean }> }>('get_folder_tree', {
        path: skillsPath,
        maxDepth: 1
      })

      const skills: InstalledSkill[] = []
      if (tree?.children) {
        for (const child of tree.children) {
          // Skip hidden folders (like .DS_Store)
          if (child.name.startsWith('.')) continue
          
          if (child.is_dir) {
            const skillMdPath = `${child.path}/SKILL.md`
            try {
              const content = await invoke<string>('read_file', { path: skillMdPath })
              skills.push({
                name: child.name,
                path: child.path,
                content,
                source,
              })
            } catch {
              // No SKILL.md, skip
            }
          }
        }
      }
      return skills
    } catch (error) {
      console.warn('Failed to load skills from', skillsPath, error)
      return []
    }
  }

  // Load installed skills for playground
  const loadInstalledSkills = async () => {
    if (!selectedToolData) return

    setLoadingSkills(true)
    try {
      const skills: InstalledSkill[] = []
      if (skillSources.personal) {
        skills.push(...await collectSkills(selectedToolData.skills_path, 'personal'))
      }
      if (skillSources.project && selectedProjectPath) {
        const projectSkillsPath = buildProjectSkillsPath(
          selectedProjectPath,
          selectedToolData.id,
          selectedToolData.config_path
        )
        skills.push(...await collectSkills(projectSkillsPath, 'project'))
      }

      const unique = new Map<string, InstalledSkill>()
      for (const skill of skills) {
        unique.set(skill.path, skill)
      }
      const loadedSkills = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
      setInstalledSkills(loadedSkills)
      
      // Filter out selected skills that no longer exist
      const validPaths = new Set(loadedSkills.map(s => s.path))
      setSelectedSkillPaths(prev => {
        const filtered = new Set<string>()
        prev.forEach(path => {
          if (validPaths.has(path)) {
            filtered.add(path)
          }
        })
        return filtered
      })
    } catch (error) {
      console.error('Failed to load installed skills:', error)
      setInstalledSkills([])
    } finally {
      setLoadingSkills(false)
    }
  }

  useEffect(() => {
    if (selectedToolData) {
      loadInstalledSkills()
    }
  }, [skillSources, selectedProjectPath, selectedToolData])

  // Filter skills by search query
  const filteredSkills = installedSkills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleSkillSelection = (skill: InstalledSkill) => {
    setSelectedSkillPaths(prev => {
      const next = new Set(prev)
      if (next.has(skill.path)) {
        next.delete(skill.path)
      } else {
        next.add(skill.path)
      }
      return next
    })
  }

  // Removed auto-select first skill - users can now run without any skill selected

  return (
    <div className="h-full flex">
      {/* Left: Tool List - Always collapsed */}
      <div className="w-14 border-r border-border-light flex flex-col">
        <div className="p-2 border-b border-border-light flex justify-center">
          <button
            onClick={handleRefreshTools}
            disabled={refreshing}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {installedTools.length > 0 ? (
            installedTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                title={tool.name}
                className={`w-full p-2.5 flex justify-center transition-colors border-b border-border-light ${
                  selectedTool === tool.id
                    ? 'bg-foreground text-background'
                    : 'hover:bg-secondary'
                }`}
              >
                <ToolIcon toolId={tool.id} size={22} />
              </button>
            ))
          ) : (
            <div className="p-2 text-center text-muted-foreground text-xs">
              —
            </div>
          )}
        </div>
      </div>

      {/* Center: Playground (main content) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedToolData ? (
          <SkillPlayground
            skills={activeSkills.map(skill => ({
              id: skill.name,
              name: skill.name,
              slug: skill.name,
              content: skill.content,
              path: skill.path,
            }))}
            variant="embedded"
            className="h-full"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Play size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a tool to start</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Skills Panel (collapsible) */}
      {selectedToolData && (
        <div className={`${skillsPanelOpen ? 'w-80' : 'w-12'} border-l border-border-light flex flex-col transition-all duration-200`}>
          {/* Panel Header */}
          <div className={`${skillsPanelOpen ? 'p-3' : 'p-2'} border-b border-border-light flex items-center ${skillsPanelOpen ? 'justify-between' : 'justify-center'}`}>
            {skillsPanelOpen && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('playground.skills')}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
                  {activeSkills.length}/{filteredSkills.length}
                </span>
              </div>
            )}
            <button
              onClick={() => setSkillsPanelOpen(!skillsPanelOpen)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded"
              title={skillsPanelOpen ? t('playground.collapsePanel') : t('playground.expandPanel')}
            >
              {skillsPanelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            </button>
          </div>

          {skillsPanelOpen ? (
            <div className="flex-1 flex flex-col overflow-hidden p-3">
              {/* Source Selector */}
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSkillSources((prev: { personal: boolean; project: boolean }) => ({ ...prev, personal: !prev.personal }))}
                    className={`px-2 py-1 text-[11px] rounded-[4px] transition-colors ${
                      skillSources.personal
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('installed.personalSkills')}
                  </button>
                  <button
                    onClick={() => setSkillSources((prev: { personal: boolean; project: boolean }) => ({ ...prev, project: !prev.project }))}
                    className={`px-2 py-1 text-[11px] rounded-[4px] transition-colors ${
                      skillSources.project
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('installed.projectSkills')}
                  </button>
                  <button
                    onClick={loadInstalledSkills}
                    disabled={loadingSkills}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    title="Refresh"
                  >
                    <RefreshCw size={12} className={loadingSkills ? 'animate-spin' : ''} />
                  </button>
                </div>
                {skillSources.project && (
                  <select
                    value={selectedProjectPath}
                    onChange={(event) => setSelectedProjectPath(event.target.value)}
                    className="w-full bg-background text-foreground text-[11px] px-2 py-1.5 rounded-[4px] border border-border cursor-pointer"
                  >
                    {toolProjects.length === 0 ? (
                      <option value="">No projects</option>
                    ) : (
                      <>
                        <option value="">Select project...</option>
                        {toolProjects.map(project => (
                          <option key={project.path} value={project.path}>
                            {project.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-7 pr-2 py-1.5 bg-secondary text-[12px] rounded-[4px] focus:outline-none"
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mb-3 text-[11px]">
                <button
                  onClick={() => setSelectedSkillPaths(new Set(filteredSkills.map(skill => skill.path)))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('installed.selectAll')}
                </button>
                <button
                  onClick={() => setSelectedSkillPaths(new Set())}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('installed.deselectAll')}
                </button>
              </div>

              {/* Skills List */}
              <div className="flex-1 overflow-auto -mx-1 px-1">
                {loadingSkills ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading...</p>
                  </div>
                ) : filteredSkills.length > 0 ? (
                  <div className="space-y-1">
                    {filteredSkills.map(skill => {
                      const isSelected = selectedSkillPaths.has(skill.path)
                      return (
                        <button
                          key={skill.path}
                          onClick={() => toggleSkillSelection(skill)}
                          className={`w-full text-left px-2.5 py-2 rounded-[6px] transition-colors ${
                            isSelected
                              ? 'bg-foreground text-background'
                              : 'hover:bg-secondary'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-[3px] border flex items-center justify-center ${
                              isSelected ? 'bg-background border-background' : 'border-border'
                            }`}>
                              {isSelected && <Check size={10} className="text-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-medium truncate">{skill.name}</div>
                              <div className={`text-[10px] ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`}>
                                {skill.source === 'personal' ? t('installed.personalSkills') : t('installed.projectSkills')}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : installedSkills.length > 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search size={20} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">{t('playground.noMatch')}</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wand2 size={20} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">{t('playground.noSkillsInstalled')}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Collapsed state - show vertical icons */
            <div className="flex-1 overflow-auto py-2">
              {filteredSkills.map(skill => {
                const isSelected = selectedSkillPaths.has(skill.path)
                return (
                  <button
                    key={skill.path}
                    onClick={() => toggleSkillSelection(skill)}
                    title={skill.name}
                    className={`w-full p-2 flex justify-center transition-colors ${
                      isSelected ? 'bg-foreground text-background' : 'hover:bg-secondary'
                    }`}
                  >
                    <Wand2 size={16} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
