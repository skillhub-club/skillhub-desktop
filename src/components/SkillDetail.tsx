import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Star, Download, ExternalLink, Github, Tag, FileText, Loader2, Folder, FolderOpen, ChevronRight, ChevronDown, Square, CheckSquare, Play } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { useTranslation } from 'react-i18next'
import type { SkillHubSkill, SkillFileNode, SkillFilesResponse } from '../types'
import { getSkillDetail, installSkill, installSkillFiles, installSkillFilesToProject, smartInstallSkill, smartInstallSkillToProject, getSkillFiles, getFileContent, buildRawGitHubUrl, type GitHubFile } from '../api/skillhub'
import { useAppStore } from '../store'
import ToolSelector from './ToolSelector'
import FilePreview from './FilePreview'
import SkillPlayground from './SkillPlayground'
import RelatedSkills from './RelatedSkills'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'


interface SkillDetailProps {
  skill: SkillHubSkill
  onClose: () => void
}

function getRatingColor(rating?: string) {
  switch (rating) {
    case 'A': return 'rating-a rating-bg-a'
    case 'B': return 'rating-b rating-bg-b'
    case 'C': return 'rating-c rating-bg-c'
    case 'D': return 'rating-d rating-bg-d'
    case 'E': return 'rating-e rating-bg-e'
    default: return 'text-gray-500 bg-gray-100'
  }
}

// Get all file paths from a tree
function getAllFilePaths(nodes: SkillFileNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      paths.push(node.path)
    } else if (node.children) {
      paths.push(...getAllFilePaths(node.children))
    }
  }
  return paths
}

// File tree node component with checkbox
function FileTreeNode({ 
  node, 
  depth = 0, 
  onSelectFile,
  selectedPath,
  checkedFiles,
  onToggleCheck
}: { 
  node: SkillFileNode
  depth?: number
  onSelectFile: (path: string) => void
  selectedPath?: string
  checkedFiles: Set<string>
  onToggleCheck: (path: string, isFolder: boolean, children?: SkillFileNode[]) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isFolder = node.type === 'folder'
  const isSelected = selectedPath === node.path
  const isChecked = isFolder 
    ? node.children?.every(c => c.type === 'folder' || checkedFiles.has(c.path)) 
    : checkedFiles.has(node.path)
  const isPartiallyChecked = isFolder && !isChecked && 
    node.children?.some(c => c.type === 'file' ? checkedFiles.has(c.path) : getAllFilePaths(c.children || []).some(p => checkedFiles.has(p)))

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 cursor-pointer text-sm hover:bg-secondary/50 rounded transition-colors ${
          isSelected ? 'bg-secondary text-foreground' : 'text-muted-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {/* Checkbox */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCheck(node.path, isFolder, node.children)
          }}
          className="h-5 w-5 p-0.5 hover:bg-secondary rounded"
        >
          {isChecked ? (
            <CheckSquare size={14} className="text-foreground" />
          ) : isPartiallyChecked ? (
            <Square size={14} className="text-foreground" />
          ) : (
            <Square size={14} className="text-muted-foreground" />
          )}
        </Button>
        
        {/* Folder expand/collapse or file icon */}
        <div
          className="flex items-center gap-1 flex-1 min-w-0"
          onClick={() => {
            if (isFolder) {
              setExpanded(!expanded)
            } else {
              onSelectFile(node.path)
            }
          }}
        >
          {isFolder ? (
            <>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? <FolderOpen size={12} className="text-yellow-500" /> : <Folder size={12} className="text-yellow-500" />}
            </>
          ) : (
            <>
              <span className="w-3" />
              <FileText size={12} className="text-blue-400" />
            </>
          )}
          <span className="truncate text-xs">{node.name}</span>
        </div>
        
        {node.size !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}K`}
          </span>
        )}
      </div>
      {isFolder && expanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode 
              key={child.path} 
              node={child} 
              depth={depth + 1}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              checkedFiles={checkedFiles}
              onToggleCheck={onToggleCheck}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SkillDetail({ skill: initialSkill, onClose }: SkillDetailProps) {
  const { t, i18n } = useTranslation()
  const { selectedToolIds, installTarget, projectPath, showToast } = useAppStore()

  const [skill, setSkill] = useState<SkillHubSkill>(initialSkill)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'content'>('overview')
  
  // File tree state
  const [filesData, setFilesData] = useState<SkillFilesResponse | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileContentLoading, setFileContentLoading] = useState(false)
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set())

  // Playground state
  const [showPlayground, setShowPlayground] = useState(false)
  
  // Calculate all file paths for "select all"
  const allFilePaths = useMemo(() => {
    if (!filesData) return []
    return getAllFilePaths(filesData.tree)
  }, [filesData])
  
  // Initialize checked files when files data loads (select all by default)
  useEffect(() => {
    if (filesData && checkedFiles.size === 0) {
      setCheckedFiles(new Set(allFilePaths))
    }
  }, [filesData, allFilePaths, checkedFiles.size])

  // Fetch full skill details
  useEffect(() => {
    setLoading(true)
    getSkillDetail(initialSkill.slug)
      .then(setSkill)
      .catch((error) => {
        console.error('Failed to load skill details:', error)
        showToast(t('skillDetail.failedToLoadDetails'), 'error')
      })
      .finally(() => setLoading(false))
  }, [initialSkill.slug, showToast])
  
  // Fetch files when Files tab is selected and skill details are loaded
  const loadFiles = useCallback(async () => {
    // Wait for skill details to load (need the UUID)
    if (!skill.id || loading || filesData || filesLoading) return
    
    setFilesLoading(true)
    try {
      const data = await getSkillFiles(skill.id)
      setFilesData(data)
    } catch (error) {
      console.error('Failed to load files:', error)
      showToast(t('skillDetail.failedToLoadFiles'), 'error')
    } finally {
      setFilesLoading(false)
    }
  }, [skill.id, loading, filesData, filesLoading, showToast])
  
  useEffect(() => {
    if (activeTab === 'files' && !loading) {
      loadFiles()
    }
  }, [activeTab, loading, loadFiles])
  
  // Load file content when a file is selected
  const handleSelectFile = useCallback(async (path: string) => {
    if (!filesData) return
    
    setSelectedFilePath(path)
    setFileContentLoading(true)
    setFileContent('')
    
    try {
      const rawUrl = buildRawGitHubUrl(
        filesData.repo_url, 
        filesData.branch, 
        path, 
        filesData.skill_path
      )
      const content = await getFileContent(rawUrl)
      setFileContent(content)
    } catch (error) {
      console.error('Failed to load file content:', error)
      showToast(t('skillDetail.failedToLoadContent'), 'error')
    } finally {
      setFileContentLoading(false)
    }
  }, [filesData, showToast])
  
  // Toggle file/folder check
  const handleToggleCheck = useCallback((path: string, isFolder: boolean, children?: SkillFileNode[]) => {
    setCheckedFiles(prev => {
      const next = new Set(prev)
      
      if (isFolder && children) {
        // Get all file paths in this folder
        const folderFilePaths = getAllFilePaths(children)
        const allChecked = folderFilePaths.every(p => next.has(p))
        
        if (allChecked) {
          // Uncheck all
          folderFilePaths.forEach(p => next.delete(p))
        } else {
          // Check all
          folderFilePaths.forEach(p => next.add(p))
        }
      } else {
        // Toggle single file
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
      }
      
      return next
    })
  }, [])

  const handleInstall = async () => {
    if (installing) return
    if (selectedToolIds.length === 0) {
      showToast(t('skillDetail.selectTool'), 'warning')
      return
    }

    if (installTarget === 'project' && !projectPath) {
      showToast(t('skillDetail.selectProjectFirst'), 'warning')
      return
    }

    // Check if we have files data and selected files
    const hasFilesSelected = checkedFiles.size > 0 && filesData

    // If we haven't loaded file list yet, default to full repo install
    if (!filesData && skill.repo_url) {
      let installSkillData = skill
      try {
        if (skill.id) {
          const data = await getSkillFiles(skill.id)
          installSkillData = {
            ...skill,
            repo_url: data.repo_url || skill.repo_url,
            skill_path: data.skill_path ?? skill.skill_path,
          }
        }
      } catch {
        // Use original skill info if file metadata fetch fails
      }
      if (installTarget === 'project' && projectPath) {
        await smartInstallSkillToProject(installSkillData, projectPath, selectedToolIds)
        showToast(t('skillDetail.installedToProject', { name: skill.name }), 'success')
      } else {
        await smartInstallSkill(installSkillData, selectedToolIds)
        showToast(t('skillDetail.installedToTools', { name: skill.name, count: selectedToolIds.length }), 'success')
      }
      onClose()
      return
    }

    if (!hasFilesSelected && !skill.skill_md_raw) {
      showToast(t('skillDetail.noFilesSelected'), 'warning')
      return
    }

    const folderName = skill.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() || skill.slug.split('-').slice(-1)[0] || 'skill'

    setInstalling(true)
    try {
      if (hasFilesSelected && filesData) {
        // Fetch all selected files content
        const filesToInstall = Array.from(checkedFiles)
        const files: GitHubFile[] = []

        for (const filePath of filesToInstall) {
          try {
            const rawUrl = buildRawGitHubUrl(
              filesData.repo_url,
              filesData.branch,
              filePath,
              filesData.skill_path
            )
            const content = await getFileContent(rawUrl)

            // Normalize SKILL.md path
            const normalizedPath = filePath.toLowerCase() === 'skill.md' ? 'SKILL.md' : filePath
            files.push({ path: normalizedPath, content })
          } catch (error) {
            console.error(`Failed to fetch ${filePath}:`, error)
          }
        }

        if (files.length > 0) {
          if (installTarget === 'project' && projectPath) {
            for (const toolId of selectedToolIds) {
              await installSkillFilesToProject(files, folderName, projectPath, toolId)
            }
            showToast(t('skillDetail.installedFilesToProject', { count: files.length }), 'success')
          } else {
            // Install all files together preserving structure
            await installSkillFiles(files, folderName, selectedToolIds)
            showToast(t('skillDetail.installedFilesToTools', { count: files.length, toolCount: selectedToolIds.length }), 'success')
          }
          onClose()
        } else {
          throw new Error('No files were fetched')
        }
      } else {
        // Fallback: install skill_md_raw
        if (!skill.skill_md_raw) {
          throw new Error('No skill content available')
        }
        if (installTarget === 'project' && projectPath) {
          const { invoke } = await import('@tauri-apps/api/core')
          for (const toolId of selectedToolIds) {
            await invoke('install_skill_to_project', {
              skillContent: skill.skill_md_raw,
              skillName: folderName,
              projectPath,
              toolId,
            })
          }
          showToast(t('skillDetail.installedToProject', { name: skill.name }), 'success')
        } else {
          await installSkill(skill.skill_md_raw, skill.name, selectedToolIds)
          showToast(t('skillDetail.installedToTools', { name: skill.name, count: selectedToolIds.length }), 'success')
        }
        onClose()
      }
    } catch (error) {
      console.error('Install failed:', error)
      showToast(t('skillDetail.installFailed'), 'error')
    } finally {
      setInstalling(false)
    }
  }

  const openGitHub = async () => {
    try {
      await open(skill.repo_url)
    } catch (error) {
      console.error('Failed to open browser:', error)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <DialogContent
          showClose={false}
          className="w-full max-w-3xl max-h-[90vh] p-0 overflow-hidden border border-border rounded-lg flex flex-col shadow-2xl"
        >
          {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-border">
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-2xl font-bold text-foreground truncate">{skill.name}</h2>
              {skill.simple_rating && (
                <span className={`px-3 py-1 rounded text-sm font-bold ${getRatingColor(skill.simple_rating)}`}>
                  {skill.simple_rating}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{t('skillDetail.byAuthor', { name: skill.author })}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-8">
            <Button
              onClick={() => setActiveTab('overview')}
            variant="ghost"
            size="sm"
            className={`h-auto px-5 py-3 text-sm font-medium border-b-2 rounded-none transition-colors ${
              activeTab === 'overview'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('skillDetail.overview')}
            </Button>
            <Button
              onClick={() => setActiveTab('files')}
            variant="ghost"
            size="sm"
            className={`h-auto px-5 py-3 text-sm font-medium border-b-2 rounded-none transition-colors flex items-center gap-2 ${
              activeTab === 'files'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              <Folder size={14} />
            {t('skillDetail.files')}
            </Button>
            <Button
              onClick={() => setActiveTab('content')}
            variant="ghost"
            size="sm"
            className={`h-auto px-5 py-3 text-sm font-medium border-b-2 rounded-none transition-colors flex items-center gap-2 ${
              activeTab === 'content'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              <FileText size={14} />
            {t('skillDetail.skillMd')}
            </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-foreground" size={32} />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                {skill.github_stars !== undefined && skill.github_stars > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star size={18} className="text-yellow-500" />
                    <span className="font-medium">{t('skillDetail.starsCount', { count: skill.github_stars })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag size={18} />
                  <span className="px-3 py-1 bg-secondary text-foreground rounded font-medium">{skill.category}</span>
                </div>
                {skill.simple_score && (
                  <div className="text-muted-foreground">
                    {t('skillDetail.scoreLabel')}{' '}
                    <span className="font-bold text-foreground">{skill.simple_score.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                  {t('skillDetail.description')}
                </h3>
                <p className="text-foreground leading-relaxed">
                  {i18n.language === 'zh' && skill.description_zh ? skill.description_zh : skill.description}
                </p>
              </div>

              {/* Tags */}
              {skill.tags && skill.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                    {t('skillDetail.tags')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skill.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-secondary text-muted-foreground text-sm rounded hover:bg-secondary/80 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GitHub Link */}
              <div>
                <Button
                  onClick={openGitHub}
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-muted-foreground hover:text-foreground text-sm"
                >
                  <Github size={16} />
                  <span>{t('skillDetail.viewOnGitHub')}</span>
                  <ExternalLink size={12} />
                </Button>
              </div>

              {/* Related Skills */}
              <RelatedSkills
                currentSkill={skill}
                onViewSkill={(relatedSkill) => {
                  // Update to view the related skill
                  setSkill(relatedSkill)
                  setFilesData(null)
                  setSelectedFilePath(null)
                  setFileContent('')
                  setCheckedFiles(new Set())
                  setActiveTab('overview')
                  setLoading(true)
                  getSkillDetail(relatedSkill.slug)
                    .then(setSkill)
                    .catch((error) => {
                      console.error('Failed to load skill details:', error)
                      showToast(t('skillDetail.failedToLoadDetails'), 'error')
                    })
                    .finally(() => setLoading(false))
                }}
                onInstallSkill={() => setShowInstallModal(true)}
              />
            </div>
          ) : activeTab === 'files' ? (
            <div className="h-full flex">
              {filesLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-foreground" size={24} />
                </div>
              ) : filesData ? (
                <>
                  {/* File tree - left side */}
                  <div className="w-56 border-r border-border pr-3 overflow-auto flex-shrink-0">
                    <div className="text-xs text-muted-foreground mb-2 px-1 flex items-center justify-between">
                      <span>
                        {t('skillDetail.selectedCount', {
                          selected: checkedFiles.size,
                          total: filesData.stats.total_files,
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (checkedFiles.size === allFilePaths.length) {
                            setCheckedFiles(new Set())
                          } else {
                            setCheckedFiles(new Set(allFilePaths))
                          }
                        }}
                        className="h-auto px-1 text-foreground hover:underline"
                      >
                        {checkedFiles.size === allFilePaths.length
                          ? t('skillDetail.selectNone')
                          : t('skillDetail.selectAll')}
                      </Button>
                    </div>
                    {filesData.tree.map(node => (
                      <FileTreeNode 
                        key={node.path} 
                        node={node}
                        onSelectFile={handleSelectFile}
                        selectedPath={selectedFilePath || undefined}
                        checkedFiles={checkedFiles}
                        onToggleCheck={handleToggleCheck}
                      />
                    ))}
                  </div>
                  
                  {/* File content - right side */}
                  <div className="flex-1 pl-4 overflow-auto">
                    {selectedFilePath ? (
                      <div>
                        <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                          <FileText size={14} />
                          {selectedFilePath}
                        </div>
                        {fileContentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-muted-foreground" size={20} />
                          </div>
                        ) : (
                          <FilePreview filename={selectedFilePath} content={fileContent} />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        {t('skillDetail.selectFileToView')}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  {t('skillDetail.failedToLoadFiles')}
                </div>
              )}
            </div>
          ) : (
            <div className="skill-content">
              {skill.skill_md_raw ? (
                <FilePreview filename="SKILL.md" content={skill.skill_md_raw} />
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText size={48} className="mx-auto mb-4 opacity-30" />
                  <p>{t('skillDetail.skillMdMissing')}</p>
                  <Button
                    onClick={openGitHub}
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-foreground"
                  >
                    {t('skillDetail.viewOnGitHub')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Install Section */}
        <div className="border-t border-border px-6 py-4 flex items-center gap-4 bg-secondary/30">
          <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
            {t('skillDetail.installTo')}
          </span>
          <div className="flex-1 min-w-0">
            <ToolSelector compact />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-auto px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => setShowPlayground(true)}
              size="sm"
              className="h-auto px-4 py-2 text-sm bg-purple-600 text-white font-semibold hover:bg-purple-700"
            >
              <Play size={14} />
              {t('skillDetail.try')}
            </Button>
            <Button
              onClick={() => setShowInstallModal(true)}
              disabled={installing || selectedToolIds.length === 0}
              size="sm"
              className="h-auto px-4 py-2 text-sm bg-foreground text-background font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {installing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('skillDetail.installing')}
                </>
              ) : (
                <>
                  <Download size={14} />
                  {t('skillDetail.install')}
                </>
              )}
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* Install Modal (reuse outer flow) */}
      {showInstallModal && (
        <Dialog
          open={showInstallModal}
          onOpenChange={(open) => (!open ? setShowInstallModal(false) : undefined)}
        >
          <DialogContent
            showClose={false}
            className="w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto border-2 border-foreground p-0"
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-border-light">
              <div>
                <h2 className="text-xl font-bold tracking-tight">{t('skillDetail.installSkill')}</h2>
                <p className="text-sm text-muted-foreground">{skill.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInstallModal(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="p-4">
              <ToolSelector showInstallTarget />
            </div>

            <div className="flex gap-3 p-4 border-t-2 border-border-light">
              <Button
                onClick={() => setShowInstallModal(false)}
                variant="outline"
                className="flex-1 border-2 border-foreground"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={async () => {
                  await handleInstall()
                  setShowInstallModal(false)
                }}
                disabled={installing || selectedToolIds.length === 0}
                className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installing ? t('skillDetail.installing') : t('skillDetail.install')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Skill Playground Modal */}
      {showPlayground && (
        <SkillPlayground
          skills={[{
            id: skill.id,
            name: skill.name,
            slug: skill.slug,
            content: skill.skill_md_raw,
          }]}
          onClose={() => setShowPlayground(false)}
          onInstall={() => {
            setShowPlayground(false)
            handleInstall()
          }}
        />
      )}
    </>
  )
}
