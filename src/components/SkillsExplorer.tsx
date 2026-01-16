import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import MDEditor from '@uiw/react-md-editor'
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
import type { FileNode, DetectedTool } from '../types'

interface SkillsExplorerProps {
  tool: DetectedTool
  onClose: () => void
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
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded text-sm ${
          isSelected
            ? 'bg-primary-100 text-primary-700'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.is_dir ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            {isExpanded ? (
              <FolderOpen size={16} className="text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder size={16} className="text-yellow-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <FileText size={16} className="text-blue-500 flex-shrink-0" />
          </>
        )}
        <span className="truncate">{node.name}</span>
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

export default function SkillsExplorer({ tool, onClose }: SkillsExplorerProps) {
  const [tree, setTree] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const loadTree = async () => {
    setLoading(true)
    try {
      const result = await invoke<FileNode>('get_folder_tree', {
        path: tool.skills_path,
        maxDepth: 5,
      })
      setTree(result)

      // Auto-expand root
      if (result) {
        setExpandedPaths(new Set([result.path]))
      }
    } catch (error) {
      console.error('Failed to load folder tree:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTree()
  }, [tool.skills_path])

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
      await invoke('open_folder', { path: tool.skills_path })
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[90vw] max-w-5xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Skills Explorer - {tool.name}
            </h2>
            <p className="text-sm text-gray-500 truncate max-w-lg">
              {tool.skills_path}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openInFinder}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Open in Finder"
            >
              <ExternalLink size={18} />
            </button>
            <button
              onClick={loadTree}
              disabled={loading}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree */}
          <div className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : tree ? (
              <div className="py-2">
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
              <div className="text-center py-8 text-gray-500">
                No files found
              </div>
            )}
          </div>

          {/* Preview Pane */}
          <div className="flex-1 overflow-y-auto">
            {selectedNode ? (
              <div className="p-4">
                {/* File Info Header */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedNode.metadata?.name || selectedNode.name}
                  </h3>
                  {selectedNode.metadata && (
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                      {selectedNode.metadata.author && (
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {selectedNode.metadata.author}
                        </span>
                      )}
                      {selectedNode.metadata.category && (
                        <span className="flex items-center gap-1">
                          <Tag size={14} />
                          {selectedNode.metadata.category}
                        </span>
                      )}
                    </div>
                  )}
                  {selectedNode.metadata?.description && (
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedNode.metadata.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400 font-mono truncate">
                    {selectedNode.path}
                  </p>
                </div>

                {/* File Content */}
                {selectedNode.content ? (
                  <div data-color-mode="light">
                    <MDEditor.Markdown
                      source={selectedNode.content}
                      style={{ padding: 16, background: '#f9fafb', borderRadius: 8 }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No content to preview
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText size={48} className="mb-2" />
                <p>Select a file to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
          {tree && (
            <span>
              {countFiles(tree)} files in {countDirs(tree)} folders
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
