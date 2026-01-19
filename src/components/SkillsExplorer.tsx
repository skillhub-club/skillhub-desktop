import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import {
  X,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  ExternalLink,
  User,
  Tag,
} from 'lucide-react'
import ToolIcon from './ToolIcon'
import FilePreview from './FilePreview'
import type { FileNode, DetectedTool } from '../types'

interface SkillsExplorerProps {
  tool: DetectedTool
  onClose: () => void
  /** Optional: directly explore this path instead of tool's default paths */
  directPath?: string
  /** Optional: custom title for the explorer */
  title?: string
}

interface TreeNodeProps {
  node: FileNode
  level: number
  selectedPath: string | null
  onSelect: (node: FileNode) => void
  expandedPaths: Set<string>
  toggleExpand: (path: string) => void
}

function TreeNode({
  node,
  level,
  selectedPath,
  onSelect,
  expandedPaths,
  toggleExpand,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const hasChildren = node.children && node.children.length > 0

  const handleClick = () => {
    if (node.is_dir) {
      toggleExpand(node.path)
    } else {
      onSelect(node)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-sm transition-colors ${
          isSelected
            ? 'bg-foreground text-background'
            : 'hover:bg-secondary text-foreground'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.is_dir ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} className={isSelected ? 'text-background/70' : 'text-muted-foreground'} />
              ) : (
                <ChevronRight size={14} className={isSelected ? 'text-background/70' : 'text-muted-foreground'} />
              )
            ) : (
              <span className="w-3.5" />
            )}
            {isExpanded ? (
              <FolderOpen size={16} className={isSelected ? 'text-background' : 'text-foreground'} />
            ) : (
              <Folder size={16} className={isSelected ? 'text-background' : 'text-foreground'} />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <FileText size={16} className={isSelected ? 'text-background' : 'text-muted-foreground'} />
          </>
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>

      {node.is_dir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SkillsExplorer({ tool, onClose, directPath, title }: SkillsExplorerProps) {
  const { t } = useTranslation()
  const [tree, setTree] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Skills-related directories for different tools
  const SKILLS_DIRS_MAP: Record<string, string[]> = {
    'claude': ['skills', 'commands', 'rules', 'plugins'],
    'codex': ['skills', 'prompts'],
  }
  
  // Use directPath if provided, otherwise use tool's default paths
  const explorePath = directPath || tool.skills_path
  const displayTitle = title || `Skills Explorer - ${tool.name}`

  // Filter tree to only show skills-related directories
  const filterSkillsTree = (node: FileNode, allowedDirs: string[]): FileNode | null => {
    if (!node.is_dir) return node
    
    // If this is the root config directory (.claude or .codex), filter children
    const isConfigRoot = node.name.startsWith('.') && (
      node.name === '.claude' || 
      node.name === '.codex' ||
      node.path.endsWith('/.claude') ||
      node.path.endsWith('/.codex')
    )
    
    if (isConfigRoot) {
      const filteredChildren = (node.children || [])
        .filter(child => !child.is_dir || allowedDirs.includes(child.name))
        .map(child => filterSkillsTree(child, allowedDirs))
        .filter((child): child is FileNode => child !== null)
      
      return { ...node, children: filteredChildren }
    }
    
    // For other directories, keep all children
    const filteredChildren = (node.children || [])
      .map(child => filterSkillsTree(child, allowedDirs))
      .filter((child): child is FileNode => child !== null)
    
    return { ...node, children: filteredChildren }
  }

  const loadTree = async () => {
    setLoading(true)
    try {
      // If directPath is provided, use it directly; otherwise use tool-specific logic
      const pathToLoad = directPath 
        ? directPath 
        : (tool.id === 'claude' ? tool.config_path : tool.skills_path)
      
      const result = await invoke<FileNode>('get_folder_tree', {
        path: pathToLoad,
        maxDepth: 5,
      })
      
      // Only filter for Claude/Codex when not in direct mode
      const allowedDirs = !directPath ? SKILLS_DIRS_MAP[tool.id] : undefined
      const filteredResult = allowedDirs && result ? filterSkillsTree(result, allowedDirs) : result
      setTree(filteredResult)

      // Auto-expand root and first level
      if (filteredResult) {
        const initialExpanded = new Set([filteredResult.path])
        if (filteredResult.children) {
          filteredResult.children.forEach(child => {
            if (child.is_dir) {
              initialExpanded.add(child.path)
            }
          })
        }
        setExpandedPaths(initialExpanded)
      }
    } catch (error) {
      console.error('Failed to load folder tree:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTree()
  }, [explorePath])

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const openInFinder = async () => {
    try {
      await invoke('open_folder', { path: explorePath })
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-background border-2 border-foreground w-[90vw] max-w-5xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground bg-secondary">
          <div className="flex items-center gap-3">
            <ToolIcon toolId={tool.id} size={32} />
            <div>
              <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                {displayTitle}
              </h2>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-lg">
                {explorePath}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={openInFinder}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title={t('explorer.openInFinder')}
            >
              <ExternalLink size={18} />
            </button>
            <button
              onClick={loadTree}
              disabled={loading}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title={t('common.refresh')}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title={t('common.close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree */}
          <div className="w-72 border-r-2 border-foreground overflow-y-auto bg-secondary">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : tree ? (
              <div className="py-1">
                <TreeNode
                  node={tree}
                  level={0}
                  selectedPath={selectedNode?.path || null}
                  onSelect={setSelectedNode}
                  expandedPaths={expandedPaths}
                  toggleExpand={toggleExpand}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t('explorer.noFiles')}
              </div>
            )}
          </div>

          {/* Preview Pane */}
          <div className="flex-1 overflow-y-auto bg-background">
            {selectedNode ? (
              <div className="p-6">
                {/* File Info Header */}
                <div className="mb-4 pb-4 border-b border-border-light">
                  <h3 className="text-xl font-bold text-foreground">
                    {selectedNode.metadata?.name || selectedNode.name}
                  </h3>
                  {selectedNode.metadata && (
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {selectedNode.metadata.author && (
                        <span className="flex items-center gap-1.5">
                          <User size={14} />
                          {selectedNode.metadata.author}
                        </span>
                      )}
                      {selectedNode.metadata.category && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary text-foreground text-xs font-semibold uppercase">
                          <Tag size={12} />
                          {selectedNode.metadata.category}
                        </span>
                      )}
                    </div>
                  )}
                  {selectedNode.metadata?.description && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {selectedNode.metadata.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground font-mono truncate">
                    {selectedNode.path}
                  </p>
                </div>

                {/* File Content */}
                {selectedNode.content ? (
                  <FilePreview
                    filename={selectedNode.name}
                    content={selectedNode.content}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('explorer.noContent')}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText size={48} className="mb-3" />
                <p className="text-sm">{t('explorer.selectFile')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="px-4 py-2 border-t-2 border-foreground bg-secondary text-sm text-muted-foreground font-mono">
          {tree && (
            <span>
              {countFiles(tree)} {t('explorer.files')} · {countDirs(tree)} {t('explorer.folders')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function countFiles(node: FileNode): number {
  if (!node.is_dir) return 1
  return (node.children || []).reduce((acc, child) => acc + countFiles(child), 0)
}

function countDirs(node: FileNode): number {
  if (!node.is_dir) return 0
  return 1 + (node.children || []).reduce((acc, child) => acc + countDirs(child), 0)
}
