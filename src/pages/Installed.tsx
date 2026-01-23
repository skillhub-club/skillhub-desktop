import { useState, useEffect } from 'react'
import {
  RefreshCw, ChevronRight, FolderOpen, Plus, Trash2,
  BookOpen, MessageCircle, Terminal, Blocks, User, Briefcase, Download
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../store'
import { detectTools } from '../api/skillhub'
import ToolIcon from '../components/ToolIcon'
import SkillsExplorer from '../components/SkillsExplorer'
import ImportSkillsModal from '../components/ImportSkillsModal'

// Category types
type CategoryType = 'skills' | 'prompts' | 'commands' | 'plugins'
type ViewMode = 'personal' | 'projects'

interface CategoryInfo {
  type: CategoryType
  icon: typeof BookOpen
  label: string
  folder: string
  description: string
}

// Category definitions
const CATEGORIES: CategoryInfo[] = [
  { type: 'skills', icon: BookOpen, label: 'Skills', folder: 'skills', description: 'Reusable skill files' },
  { type: 'prompts', icon: MessageCircle, label: 'Prompts', folder: 'prompts', description: 'System prompts' },
  { type: 'commands', icon: Terminal, label: 'Commands', folder: 'commands', description: 'Custom commands' },
  { type: 'plugins', icon: Blocks, label: 'Plugins', folder: 'plugins', description: 'Extension plugins' },
]

// Tool config folder names
const TOOL_CONFIG_FOLDERS: Record<string, string> = {
  claude: '.claude',
  codex: '.codex',
  cursor: '.cursor',
  cline: '.cline',
  gemini: '.gemini',
  opencode: '.opencode',
  kilocode: '.kilocode',
  copilot: '.copilot',
  windsurf: '.windsurf',
}

interface CategoryCounts {
  skills: number
  prompts: number
  commands: number
  plugins: number
}

interface ProjectCountsResult {
  counts: CategoryCounts
  hasToolConfig: boolean
}

interface ProjectInfo {
  path: string
  name: string
  toolId: string
  hasToolConfig: boolean
  counts: CategoryCounts
}

export default function Installed() {
  const { t } = useTranslation()
  const { tools, setTools, showToast } = useAppStore()

  const [selectedTool, setSelectedTool] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('personal')
  
  // Personal category counts
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({
    skills: 0, prompts: 0, commands: 0, plugins: 0
  })
  
  // Projects
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  
  // Explorer modal state
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerPath, setExplorerPath] = useState<string>('')
  const [explorerTitle, setExplorerTitle] = useState<string>('')

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importCategory, setImportCategory] = useState<CategoryType>('skills')

  const installedTools = tools.filter(t => t.installed)
  const selectedToolData = tools.find(t => t.id === selectedTool)
  
  // Filter projects by selected tool
  const toolProjects = projects.filter(p => p.toolId === selectedTool)

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
      } catch (e) {
        console.error('Failed to parse projects:', e)
      }
    }
  }, [])

  // Load category counts when tool changes
  useEffect(() => {
    if (selectedTool && selectedToolData) {
      loadCategoryCounts()
      setSelectedProject(null)
    }
  }, [selectedTool, selectedToolData])

  useEffect(() => {
    if (!selectedProject) return
    let cancelled = false
    loadProjectCounts(selectedProject)
      .then((result) => {
        if (cancelled) return
        setProjects((prev) => {
          const updated = prev.map(p =>
            p.path === selectedProject.path && p.toolId === selectedProject.toolId
              ? { ...p, counts: result.counts, hasToolConfig: result.hasToolConfig }
              : p
          )
          localStorage.setItem('skillhub_projects', JSON.stringify(updated))
          return updated
        })
        setSelectedProject({ ...selectedProject, counts: result.counts, hasToolConfig: result.hasToolConfig })
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [selectedProject])

  const loadCategoryCounts = async () => {
    if (!selectedToolData) return
    
    const basePath = selectedToolData.config_path
    const counts: CategoryCounts = { skills: 0, prompts: 0, commands: 0, plugins: 0 }
    
    for (const cat of CATEGORIES) {
      const path = `${basePath}/${cat.folder}`
      try {
        const exists = await invoke<boolean>('check_path_exists', { path }).catch(() => false)
        if (exists) {
          const tree = await invoke<{ children?: unknown[] }>('get_folder_tree', { path, maxDepth: 1 })
          counts[cat.type] = tree?.children?.length || 0
        } else {
          counts[cat.type] = 0
        }
      } catch {
        counts[cat.type] = 0
      }
    }
    
    setCategoryCounts(counts)
  }

  const loadProjectCounts = async (project: ProjectInfo): Promise<ProjectCountsResult> => {
    const configFolder = TOOL_CONFIG_FOLDERS[selectedTool] || `.${selectedTool}`
    const basePath = `${project.path}/${configFolder}`
    const counts: CategoryCounts = { skills: 0, prompts: 0, commands: 0, plugins: 0 }
    
    const hasToolConfig = await invoke<boolean>('check_path_exists', { path: basePath }).catch(() => false)
    if (!hasToolConfig) {
      return { counts, hasToolConfig }
    }

    for (const cat of CATEGORIES) {
      const path = `${basePath}/${cat.folder}`
      try {
        const exists = await invoke<boolean>('check_path_exists', { path }).catch(() => false)
        if (exists) {
          const tree = await invoke<{ children?: unknown[] }>('get_folder_tree', { path, maxDepth: 1 })
          counts[cat.type] = tree?.children?.length || 0
        } else {
          counts[cat.type] = 0
        }
      } catch {
        counts[cat.type] = 0
      }
    }
    
    return { counts, hasToolConfig }
  }

  const handleRefreshTools = async () => {
    setRefreshing(true)
    try {
      const newTools = await detectTools()
      setTools(newTools)
      await loadCategoryCounts()
      // Refresh project counts
      await refreshProjectCounts()
      showToast(t('installed.refreshed'), 'success')
    } catch (error) {
      console.error('Refresh failed:', error)
      showToast(t('installed.refreshFailed'), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const refreshProjectCounts = async () => {
    const updatedProjects = await Promise.all(
      projects.map(async (p) => {
        if (p.toolId === selectedTool) {
          const result = await loadProjectCounts(p)
          return { ...p, counts: result.counts, hasToolConfig: result.hasToolConfig }
        }
        return p
      })
    )
    setProjects(updatedProjects)
    localStorage.setItem('skillhub_projects', JSON.stringify(updatedProjects))
  }

  // Add project
  const handleAddProject = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t('installed.selectProject'),
      })
      
      if (selected && typeof selected === 'string') {
        if (projects.some(p => p.path === selected && p.toolId === selectedTool)) {
          showToast(t('installed.projectAlreadyAdded'), 'warning')
          return
        }
        
        const configFolder = TOOL_CONFIG_FOLDERS[selectedTool] || `.${selectedTool}`
        const configPath = `${selected}/${configFolder}`
        const hasToolConfig = await invoke<boolean>('check_path_exists', { path: configPath }).catch(() => false)
        
        const projectName = selected.split('/').pop() || selected
        const newProject: ProjectInfo = {
          path: selected,
          name: projectName,
          toolId: selectedTool,
          hasToolConfig,
          counts: { skills: 0, prompts: 0, commands: 0, plugins: 0 }
        }
        
        // Load counts if config exists
        if (hasToolConfig) {
          const result = await loadProjectCounts(newProject)
          newProject.counts = result.counts
          newProject.hasToolConfig = result.hasToolConfig
        }
        
        const newProjects = [...projects, newProject]
        setProjects(newProjects)
        localStorage.setItem('skillhub_projects', JSON.stringify(newProjects))
        showToast(t('installed.projectAdded'), 'success')
      }
    } catch (error) {
      console.error('Failed to add project:', error)
      showToast(t('installed.failedToAddProject'), 'error')
    }
  }

  // Remove project
  const handleRemoveProject = (project: ProjectInfo) => {
    const newProjects = projects.filter(p => !(p.path === project.path && p.toolId === project.toolId))
    setProjects(newProjects)
    localStorage.setItem('skillhub_projects', JSON.stringify(newProjects))
    if (selectedProject?.path === project.path) {
      setSelectedProject(null)
    }
    showToast('Project removed', 'success')
  }

  // Open category in SkillsExplorer
  const openCategory = (category: CategoryType, basePath: string, titlePrefix: string) => {
    if (!selectedToolData) return
    
    const catInfo = CATEGORIES.find(c => c.type === category)
    if (!catInfo) return
    
    const path = `${basePath}/${catInfo.folder}`
    setExplorerPath(path)
    setExplorerTitle(`${titlePrefix} - ${catInfo.label}`)
    setExplorerOpen(true)
  }

  // Open folder in Finder
  const openFolder = async (path: string) => {
    try {
      await invoke('open_folder', { path })
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  // Open import modal for a category
  const openImportModal = (category: CategoryType) => {
    setImportCategory(category)
    setImportModalOpen(true)
  }

  // Get source path for import (personal skills)
  const getPersonalCategoryPath = (category: CategoryType) => {
    if (!selectedToolData) return ''
    const catInfo = CATEGORIES.find(c => c.type === category)
    if (!catInfo) return ''
    return `${selectedToolData.config_path}/${catInfo.folder}`
  }

  // Get destination path for import (project skills)
  const getProjectCategoryPath = (category: CategoryType) => {
    if (!selectedProject) return ''
    const configFolder = TOOL_CONFIG_FOLDERS[selectedTool] || `.${selectedTool}`
    const catInfo = CATEGORIES.find(c => c.type === category)
    if (!catInfo) return ''
    return `${selectedProject.path}/${configFolder}/${catInfo.folder}`
  }

  return (
    <div className="h-full flex">
      {/* Left: Tool List */}
      <div className="w-56 border-r border-border-light flex flex-col">
        <div className="p-4 border-b border-border-light">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('settings.tools')}
            </h2>
            <button
              onClick={handleRefreshTools}
              disabled={refreshing}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={t('common.refresh')}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {installedTools.length > 0 ? (
            installedTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={`w-full p-3 text-left transition-colors border-b border-border-light ${
                  selectedTool === tool.id 
                    ? 'bg-foreground text-background' 
                    : 'hover:bg-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ToolIcon toolId={tool.id} size={24} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm truncate block">{tool.name}</span>
                    <span className={`text-xs ${selectedTool === tool.id ? 'text-background/70' : 'text-muted-foreground'}`}>
                      {tool.skills_count} items
                    </span>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {t('installed.noTools')}
            </div>
          )}
        </div>
      </div>

      {/* Right: Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedToolData ? (
          <>
            {/* Tool Header with View Mode Toggle */}
            <div className="p-4 border-b border-border-light">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <ToolIcon toolId={selectedToolData.id} size={40} />
                  <div>
                    <h2 className="text-lg font-bold">{selectedToolData.name}</h2>
                    <p className="text-xs text-muted-foreground font-mono">{selectedToolData.config_path}</p>
                  </div>
                </div>
                
                {/* View Mode Toggle */}
                <div className="flex border-2 border-border-light">
                  <button
                    onClick={() => { setViewMode('personal'); setSelectedProject(null); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                      viewMode === 'personal'
                        ? 'bg-foreground text-background'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    <User size={16} />
                    Personal
                  </button>
                  <button
                    onClick={() => setViewMode('projects')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                      viewMode === 'projects'
                        ? 'bg-foreground text-background'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    <Briefcase size={16} />
                    Projects
                  </button>
                </div>
              </div>
            </div>

            {/* Content based on view mode */}
            <div className="flex-1 p-6 overflow-auto">
              {viewMode === 'personal' ? (
                // Personal Skills View
                <>
                  <div className="grid grid-cols-2 gap-4 max-w-2xl">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon
                      const count = categoryCounts[cat.type]
                      return (
                        <button
                          key={cat.type}
                          onClick={() => openCategory(cat.type, selectedToolData.config_path, selectedToolData.name)}
                          className="card p-5 text-left hover:border-foreground transition-colors group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 bg-secondary">
                              <Icon size={24} />
                            </div>
                            <ChevronRight size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                          <h3 className="font-bold text-lg mb-1">{cat.label}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{cat.description}</p>
                          <div className="text-2xl font-bold">{count}</div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-6 pt-6 border-t border-border-light max-w-2xl">
                    <button
                      onClick={() => openFolder(selectedToolData.config_path)}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <FolderOpen size={16} />
                      Open config folder
                    </button>
                  </div>
                </>
              ) : (
                // Projects View
                <>
                  {/* Project List or Category Cards */}
                  {selectedProject ? (
                    // Show categories for selected project
                    <>
                      <div className="flex items-center justify-between mb-4 max-w-2xl">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedProject(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            ← Back
                          </button>
                          <div>
                            <h3 className="font-bold">{selectedProject.name}</h3>
                            <p className="text-xs text-muted-foreground font-mono">{selectedProject.path}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const configFolder = TOOL_CONFIG_FOLDERS[selectedTool] || `.${selectedTool}`
                            openFolder(`${selectedProject.path}/${configFolder}`)
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <FolderOpen size={18} />
                        </button>
                      </div>

                      {selectedProject.hasToolConfig ? (
                        <div className="grid grid-cols-2 gap-4 max-w-2xl">
                          {CATEGORIES.map(cat => {
                            const Icon = cat.icon
                            const count = selectedProject.counts[cat.type]
                            const configFolder = TOOL_CONFIG_FOLDERS[selectedTool] || `.${selectedTool}`
                            return (
                              <div
                                key={cat.type}
                                className="card p-5 hover:border-foreground transition-colors group"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="p-2 bg-secondary">
                                    <Icon size={24} />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => openImportModal(cat.type)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Download size={14} />
                                      Import
                                    </button>
                                    <button
                                      onClick={() => openCategory(cat.type, `${selectedProject.path}/${configFolder}`, selectedProject.name)}
                                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                    >
                                      <ChevronRight size={18} />
                                    </button>
                                  </div>
                                </div>
                                <button
                                  onClick={() => openCategory(cat.type, `${selectedProject.path}/${configFolder}`, selectedProject.name)}
                                  className="text-left w-full"
                                >
                                  <h3 className="font-bold text-lg mb-1">{cat.label}</h3>
                                  <p className="text-sm text-muted-foreground mb-2">{cat.description}</p>
                                  <div className="text-2xl font-bold">{count}</div>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="card p-6 text-center text-muted-foreground max-w-2xl">
                          <p>No {TOOL_CONFIG_FOLDERS[selectedTool] || `.${selectedTool}`} folder found in this project.</p>
                          <p className="text-sm mt-2">Create the folder to start adding project-level skills.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    // Show project list
                    <>
                      <div className="flex items-center justify-between mb-4 max-w-2xl">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Projects ({toolProjects.length})
                        </h3>
                        <button
                          onClick={handleAddProject}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary border-2 border-border-light hover:border-foreground transition-colors"
                        >
                          <Plus size={16} />
                          Add Project
                        </button>
                      </div>

                      {toolProjects.length > 0 ? (
                        <div className="space-y-2 max-w-2xl">
                          {toolProjects.map(project => {
                            const totalCount = project.counts.skills + project.counts.prompts + project.counts.commands + project.counts.plugins
                            return (
                              <div
                                key={project.path}
                                className="card p-4 flex items-center justify-between hover:border-foreground transition-colors cursor-pointer group"
                                onClick={() => setSelectedProject(project)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-secondary">
                                    <Briefcase size={20} />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold">{project.name}</h4>
                                    <p className="text-xs text-muted-foreground font-mono truncate max-w-md">{project.path}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                      {project.hasToolConfig ? (
                                        <span className="text-xs text-muted-foreground">
                                          {totalCount} items
                                        </span>
                                      ) : (
                                        <span className="text-xs text-yellow-600">
                                          No config folder
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveProject(project)
                                    }}
                                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  <ChevronRight size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="card p-8 text-center text-muted-foreground max-w-2xl">
                          <Briefcase size={32} className="mx-auto mb-3 opacity-50" />
                          <p>No projects added yet</p>
                          <p className="text-sm mt-1">Add a project folder to manage its skills</p>
                          <button
                            onClick={handleAddProject}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
                          >
                            <Plus size={16} />
                            Add Project
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a tool to manage
          </div>
        )}
      </div>

      {/* Skills Explorer Modal */}
      {explorerOpen && selectedToolData && (
        <SkillsExplorer
          tool={selectedToolData}
          onClose={() => {
            setExplorerOpen(false)
            loadCategoryCounts()
            refreshProjectCounts()
          }}
          directPath={explorerPath}
          title={explorerTitle}
        />
      )}

      {/* Import Skills Modal */}
      {importModalOpen && selectedToolData && selectedProject && (
        <ImportSkillsModal
          sourcePath={getPersonalCategoryPath(importCategory)}
          destPath={getProjectCategoryPath(importCategory)}
          toolName={selectedToolData.name}
          onClose={() => setImportModalOpen(false)}
          onImported={async () => {
            showToast('Skills imported successfully', 'success')
            // Refresh counts
            if (selectedProject) {
              const result = await loadProjectCounts(selectedProject)
              const updated = projects.map(p =>
                p.path === selectedProject.path && p.toolId === selectedProject.toolId
                  ? { ...p, counts: result.counts, hasToolConfig: result.hasToolConfig }
                  : p
              )
              setProjects(updated)
              localStorage.setItem('skillhub_projects', JSON.stringify(updated))
              setSelectedProject({ ...selectedProject, counts: result.counts, hasToolConfig: result.hasToolConfig })
            }
            setImportModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
