import { useState, useRef, useEffect } from 'react'
import {
  Glasses,
  PenLine,
  Upload,
  Save,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  HardDrive,
  Cloud,
  Info,
  FolderArchive,
  FilePlus2,
  FileText,
  Trash2,
  X,
} from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { unzipSync, strFromU8, strToU8 } from 'fflate'
import { useAppStore } from '../store'
import { detectTools, installSkill, installSkillFiles, getUploadUrl } from '../api/skillhub'
import {
  createUserSkill,
  uploadSkillFiles,
  publishSkill,
} from '../api/skillhub'
import AIGenerateDialog from '../components/AIGenerateDialog'
import AIIterateEditor from '../components/AIIterateEditor'
import ToolSelector from '../components/ToolSelector'
import type { SkillVisibility, UserSkillFile } from '../types'

const CATEGORIES = [
  { id: 'development', label: 'Development' },
  { id: 'devops', label: 'DevOps' },
  { id: 'testing', label: 'Testing' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'ai-ml', label: 'AI/ML' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'security', label: 'Security' },
  { id: 'other', label: 'Other' },
]

const VISIBILITY_OPTIONS: { id: SkillVisibility; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'public', label: 'Public', icon: <Globe size={16} />, desc: 'Anyone can discover and use' },
  { id: 'unlisted', label: 'Unlisted', icon: <Link2 size={16} />, desc: 'Only accessible via link' },
  { id: 'private', label: 'Private', icon: <Lock size={16} />, desc: 'Only you can access' },
]

type SaveTarget = 'local' | 'cloud'

const SKILL_TEMPLATE = `# Skill Name

Brief description of what this skill does.

## When to Use

- Use case 1
- Use case 2

## Instructions

Detailed instructions for the AI assistant...

## Examples

\`\`\`
Example usage or code
\`\`\`
`

const MAX_PACKAGE_BYTES = 30 * 1024 * 1024

type SkillFile = {
  path: string
  data: Uint8Array
  text?: string
  isBinary: boolean
  size: number
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-]+|[-]+$/g, '') || 'skill'
}

function createTextFile(path: string, content: string): SkillFile {
  const data = strToU8(content)
  return { path, data, text: content, isBinary: false, size: data.length }
}

function looksBinary(data: Uint8Array): boolean {
  const sample = Math.min(data.length, 512)
  let controlBytes = 0
  for (let i = 0; i < sample; i++) {
    const b = data[i]
    if (b === 9 || b === 10 || b === 13) continue
    if (b < 32 || b === 127) controlBytes++
  }
  return controlBytes / sample > 0.3
}

function getContentType(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.md')) return 'text/markdown'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.ts')) return 'text/plain'
  if (lower.endsWith('.js')) return 'application/javascript'
  if (lower.endsWith('.py')) return 'text/x-python'
  if (lower.endsWith('.sh')) return 'text/x-shellscript'
  return 'application/octet-stream'
}

function classifyKind(path: string): UserSkillFile['kind'] {
  const lower = path.toLowerCase()
  if (lower === 'skill.md') return 'skill_md'
  if (lower.includes('manifest')) return 'manifest'
  if (lower.startsWith('assets/')) return 'asset'
  return 'other'
}

function hasSkillMd(files: SkillFile[]) {
  return files.some(f => f.path.toLowerCase() === 'skill.md')
}

function totalSize(files: SkillFile[]) {
  return files.reduce((sum, f) => sum + f.size, 0)
}

export default function CreateSkill() {
  const { isAuthenticated, accessToken, tools, setTools, selectedToolIds, showToast, theme } = useAppStore()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionZh, setDescriptionZh] = useState('')
  const [category, setCategory] = useState('development')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<SkillVisibility>('private')

  // UI state
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('local')
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [showAIIterateEditor, setShowAIIterateEditor] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [files, setFiles] = useState<SkillFile[]>([createTextFile('SKILL.md', SKILL_TEMPLATE)])
  const [activeFile, setActiveFile] = useState('SKILL.md')
  const [binaryNotice, setBinaryNotice] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const categoryRef = useRef<HTMLDivElement>(null)
  const visibilityRef = useRef<HTMLDivElement>(null)

  // Load tools on mount
  useEffect(() => {
    detectTools().then(setTools).catch(console.error)
  }, [setTools])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false)
      }
      if (visibilityRef.current && !visibilityRef.current.contains(e.target as Node)) {
        setShowVisibilityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset success state after delay
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

  const handleAIApply = (generatedContent: string, _generationId: string) => {
    setFiles(prev => {
      const updated = prev.map(f => f.path.toLowerCase() === 'skill.md'
        ? createTextFile(f.path, generatedContent)
        : f
      )
      if (!updated.some(f => f.path.toLowerCase() === 'skill.md')) {
        updated.unshift(createTextFile('SKILL.md', generatedContent))
      }
      return updated
    })
    setActiveFile('SKILL.md')
    const nameMatch = generatedContent.match(/^#\s+(.+)$/m)
    if (nameMatch && !name) setName(nameMatch[1].trim())
  }

  const validateForm = (): string | null => {
    if (!name.trim()) return 'Please enter a skill name'
    if (!hasSkillMd(files)) return 'SKILL.md is required'
    if (totalSize(files) > MAX_PACKAGE_BYTES) return 'Package exceeds 30MB limit'
    if (saveTarget === 'local' && selectedToolIds.length === 0) {
      return 'Please select at least one tool to install to'
    }
    if (saveTarget === 'cloud' && !isAuthenticated) {
      return 'Please login to upload to cloud'
    }
    return null
  }

  const handleSaveLocal = async () => {
    if (selectedToolIds.length === 0) {
      showToast('Please select at least one tool', 'warning')
      return
    }

    const textFiles = files.filter(f => !f.isBinary)
    if (textFiles.length === 0) {
      showToast('Cannot install: only binary files found. Export Claude zip instead.', 'warning')
      return
    }

    setSaving(true)
    try {
      const skillName = slugify(name)
      const skillMd = textFiles.find(f => f.path.toLowerCase() === 'skill.md')

      if (textFiles.length === 1 && skillMd) {
        await installSkill(skillMd.text || strFromU8(skillMd.data), skillName, selectedToolIds)
      } else {
        const installable = textFiles.map(f => ({
          path: f.path,
          content: f.text || strFromU8(f.data),
        }))
        await installSkillFiles(installable, skillName, selectedToolIds)
      }

      if (files.some(f => f.isBinary)) {
        showToast('Installed text files. Binary assets available in Claude zip export.', 'warning')
      } else {
        showToast(`Skill installed to ${selectedToolIds.length} tool(s)`, 'success')
      }
      setSaveSuccess(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to install skill', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCloud = async () => {
    if (!isAuthenticated || !accessToken) {
      showToast('Please login to upload to cloud', 'warning')
      return
    }

    setSaving(true)
    try {
      // Step 1: Create skill
      const skill = await createUserSkill(accessToken, {
        name: name.trim(),
        description: description.trim() || name.trim(),
        description_zh: descriptionZh.trim() || undefined,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        visibility,
      })

      const uploadable: UserSkillFile[] = []

      // Upload binary/large files via presigned URL, text inline
      for (const file of files) {
        const kind = classifyKind(file.path)
        const contentType = getContentType(file.path)

        if (!file.isBinary && file.size < 2 * 1024 * 1024) {
          uploadable.push({
            filepath: file.path,
            content: file.text || strFromU8(file.data),
            kind,
            contentType,
            size: file.size,
          })
          continue
        }

        const { uploadUrl, storagePath } = await getUploadUrl(accessToken, skill.id, {
          filepath: file.path,
          contentType,
          size: file.size,
          kind,
        })

        const uploadBody = new Uint8Array(file.data)

        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: new Blob([uploadBody], { type: contentType }),
        })

        uploadable.push({
          filepath: file.path,
          storagePath,
          kind,
          contentType,
          size: file.size,
        })
      }

      const { version } = await uploadSkillFiles(accessToken, skill.id, {
        files: uploadable,
        changeSummary: 'Initial upload',
      })

      // Step 3: Optionally publish if public/unlisted
      if (visibility !== 'private') {
        await publishSkill(accessToken, skill.id, {
          version,
          changeSummary: 'Initial release',
        })
      }

      showToast(
        visibility === 'private'
          ? 'Skill saved as draft'
          : `Skill published as ${visibility}`,
        'success'
      )
      setSaveSuccess(true)

      // Reset form
      setName('')
      setDescription('')
      setDescriptionZh('')
      setTags('')
      setFiles([createTextFile('SKILL.md', SKILL_TEMPLATE)])
      setActiveFile('SKILL.md')
      setBinaryNotice(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload skill', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    const error = validateForm()
    if (error) {
      showToast(error, 'warning')
      return
    }

    if (saveTarget === 'local') {
      handleSaveLocal()
    } else {
      handleSaveCloud()
    }
  }

  const installedTools = tools.filter(t => t.installed)
  const selectedCategory = CATEGORIES.find(c => c.id === category)
  const selectedVisibility = VISIBILITY_OPTIONS.find(v => v.id === visibility)
  const activeFileData = files.find(f => f.path === activeFile)

  const handleFileContentChange = (value: string | undefined) => {
    if (!activeFileData) return
    const text = value ?? ''
    const updated = files.map(f => {
      if (f.path !== activeFileData.path) return f
      return createTextFile(f.path, text)
    })
    setFiles(updated)
  }

  const handleAddFile = () => {
    const newPath = prompt('Enter relative path (e.g., README.md or assets/example.txt)')
    if (!newPath) return
    const cleanPath = newPath.trim().replace(/^\/+/, '')
    if (!cleanPath || cleanPath.includes('..')) {
      showToast('Invalid path', 'warning')
      return
    }
    if (files.some(f => f.path.toLowerCase() === cleanPath.toLowerCase())) {
      showToast('File already exists', 'warning')
      return
    }
    const updated = [...files, createTextFile(cleanPath, '')]
    setFiles(updated)
    setActiveFile(cleanPath)
  }

  const handleRemoveFile = (path: string) => {
    if (path.toLowerCase() === 'skill.md') {
      showToast('SKILL.md is required', 'warning')
      return
    }
    setFiles(prev => prev.filter(f => f.path !== path))
    if (activeFile === path) {
      setActiveFile('SKILL.md')
    }
  }

  const handleImportZip = async (file: File) => {
    if (file.size > MAX_PACKAGE_BYTES) {
      showToast('Zip exceeds 30MB limit', 'warning')
      return
    }
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const entries = unzipSync(data)
      const entryNames = Object.keys(entries).filter(name => !name.startsWith('__MACOSX/'))
      if (entryNames.length === 0) {
        showToast('Zip is empty', 'warning')
        return
      }

      // Require a root folder
      const first = entryNames[0]
      const root = first.includes('/') ? first.split('/')[0] : null
      if (!root) {
        showToast('Zip must contain a top-level folder with SKILL.md', 'warning')
        return
      }

      const imported: SkillFile[] = []
      let binaryCount = 0

      for (const fullPath of entryNames) {
        if (!fullPath.startsWith(root + '/')) {
          showToast('Zip must have a single top-level folder', 'warning')
          return
        }
        const rel = fullPath.slice(root.length + 1)
        if (!rel || rel.endsWith('/')) continue
        if (rel.includes('..')) {
          showToast('Zip contains invalid paths', 'warning')
          return
        }
        const fileData = entries[fullPath]
        const binary = looksBinary(fileData)
        const text = binary ? undefined : strFromU8(fileData)
        if (binary) binaryCount++
        imported.push({
          path: rel,
          data: fileData,
          text,
          isBinary: binary,
          size: fileData.length,
        })
      }

      if (!hasSkillMd(imported)) {
        showToast('SKILL.md missing in zip', 'warning')
        return
      }

      setFiles(imported)
      setActiveFile('SKILL.md')
      setBinaryNotice(binaryCount > 0 ? `Imported ${binaryCount} binary file(s). They can be exported as Claude zip but not edited.` : null)
      showToast('Imported Claude zip package', 'success')
    } catch (error) {
      console.error(error)
      showToast('Failed to import zip', 'error')
    }
  }

  const onZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImportZip(file)
    e.target.value = ''
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Create Skill</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Write a new skill and save locally or upload to SkillHub Cloud
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={onZipInputChange}
            />
            
            {/* Import - for editing existing skill packages */}
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg border border-border-light transition-colors group relative"
              title="Import an existing skill package (.zip)"
            >
              <FolderArchive size={14} />
              Import .zip
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg border border-border whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                Import existing skill package to edit
              </span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-border-light mx-1" />

            {/* AI actions */}
            <button
              onClick={() => setShowAIDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Glasses size={16} />
              AI Generate
            </button>
            <button
              onClick={() => setShowAIIterateEditor(true)}
              disabled={!hasSkillMd(files)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PenLine size={16} />
              AI Edit
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-border-light mx-1" />

            {/* Preview toggle */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showPreview
                  ? 'bg-foreground text-background'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
              }`}
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Name Input */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-border">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Skill name..."
              className="w-full text-lg font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Files + Editor */}
          <div className="flex-1 flex overflow-hidden" data-color-mode={theme}>
            <div className="w-64 border-r border-border flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-medium text-foreground">Files</span>
                <button
                  onClick={handleAddFile}
                  className="flex items-center gap-1 text-xs px-2 py-1 border rounded-md border-border hover:border-foreground"
                >
                  <FilePlus2 size={14} />
                  Add
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {files.map(file => (
                  <div
                    key={file.path}
                    className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer border-b border-border/50 ${
                      activeFile === file.path ? 'bg-secondary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setActiveFile(file.path)}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className={file.path.toLowerCase() === 'skill.md' ? 'text-foreground' : 'text-muted-foreground'} />
                      <span className="truncate">{file.path}</span>
                    </div>
                    {file.path.toLowerCase() !== 'skill.md' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFile(file.path)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                Package size: {(totalSize(files) / (1024 * 1024)).toFixed(1)} MB / 30 MB
                {binaryNotice && (
                  <div className="mt-2 text-[11px] text-amber-500">
                    {binaryNotice}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {showPreview ? (
                <div className="p-6 prose dark:prose-invert max-w-none">
                  <MDEditor.Markdown
                    source={activeFileData?.isBinary ? '*Binary file preview not supported*' : (activeFileData?.text ?? '')}
                    style={{ background: 'transparent' }}
                  />
                </div>
              ) : activeFileData?.isBinary ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Binary file editing is not supported. Export Claude zip to keep this file.
                </div>
              ) : (
                <MDEditor
                  value={activeFileData?.text ?? ''}
                  onChange={handleFileContentChange}
                  preview="edit"
                  hideToolbar={false}
                  height="100%"
                  className="!bg-transparent"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 flex-shrink-0 border-l border-border overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Save Target Toggle */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Save to
              </label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setSaveTarget('local')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    saveTarget === 'local'
                      ? 'bg-foreground text-background'
                      : 'bg-background text-foreground hover:bg-secondary'
                  }`}
                >
                  <HardDrive size={16} />
                  Local
                </button>
                <button
                  onClick={() => setSaveTarget('cloud')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    saveTarget === 'cloud'
                      ? 'bg-foreground text-background'
                      : 'bg-background text-foreground hover:bg-secondary'
                  }`}
                >
                  <Cloud size={16} />
                  Cloud
                </button>
              </div>
            </div>

            {/* Local Save Options */}
            {saveTarget === 'local' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Skill will be installed directly to selected tools on your machine.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Install to
                  </label>
                  {installedTools.length > 0 ? (
                    <ToolSelector compact />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No AI coding tools detected
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Cloud Save Options */}
            {saveTarget === 'cloud' && (
              <div className="space-y-4">
                {!isAuthenticated && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Please login to upload skills to SkillHub Cloud.
                    </p>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description of your skill..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Description (Chinese) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Description (Chinese)
                    <span className="text-muted-foreground font-normal ml-1">optional</span>
                  </label>
                  <textarea
                    value={descriptionZh}
                    onChange={e => setDescriptionZh(e.target.value)}
                    placeholder="中文描述..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Category */}
                <div ref={categoryRef} className="relative">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Category
                  </label>
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground hover:border-foreground transition-colors"
                  >
                    <span>{selectedCategory?.label}</span>
                    <ChevronDown size={16} className={`transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showCategoryDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setCategory(cat.id)
                            setShowCategoryDropdown(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors ${
                            category === cat.id ? 'bg-secondary font-medium' : ''
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Tags
                    <span className="text-muted-foreground font-normal ml-1">comma separated</span>
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="react, typescript, testing"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Visibility */}
                <div ref={visibilityRef} className="relative">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Visibility
                  </label>
                  <button
                    onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground hover:border-foreground transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {selectedVisibility?.icon}
                      {selectedVisibility?.label}
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${showVisibilityDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showVisibilityDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-background border border-border rounded-lg shadow-lg">
                      {VISIBILITY_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setVisibility(opt.id)
                            setShowVisibilityDropdown(false)
                          }}
                          className={`w-full px-3 py-2.5 text-left text-foreground hover:bg-secondary transition-colors ${
                            visibility === opt.id ? 'bg-secondary' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {opt.icon}
                            {opt.label}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                            {opt.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={() => {
                if (saveTarget === 'local') {
                  setShowInstallModal(true)
                } else {
                  handleSave()
                }
              }}
              disabled={saving || (saveTarget === 'cloud' && !isAuthenticated)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                saveSuccess
                  ? 'bg-green-600 text-white'
                  : saving
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-foreground text-background hover:opacity-90'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {saveTarget === 'local' ? 'Installing...' : 'Uploading...'}
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 size={18} />
                  {saveTarget === 'local' ? 'Installed!' : 'Uploaded!'}
                </>
              ) : (
                <>
                  {saveTarget === 'local' ? <Save size={18} /> : <Upload size={18} />}
                  {saveTarget === 'local' ? 'Install Locally' : 'Upload to Cloud'}
                </>
              )}
            </button>
          </div>
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
                <h2 className="text-xl font-bold tracking-tight">INSTALL SKILL</h2>
                <p className="text-sm text-muted-foreground">{name || 'New Skill'}</p>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <ToolSelector showInstallTarget />
            </div>

            <div className="flex gap-3 p-4 border-t-2 border-border-light">
              <button
                onClick={() => setShowInstallModal(false)}
                className="flex-1 px-4 py-2 border-2 border-border text-foreground font-medium rounded hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowInstallModal(false)
                  await handleSave()
                }}
                disabled={saving || selectedToolIds.length === 0}
                className="flex-1 px-4 py-2 bg-foreground text-background font-medium rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Installing...' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Dialog */}
      <AIGenerateDialog
        open={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        onApply={handleAIApply}
        category={category}
      />

      {/* AI Iterate Editor */}
      {showAIIterateEditor && (
        <AIIterateEditor
          content={files.find(f => f.path.toLowerCase() === 'skill.md')?.text || ''}
          onApply={(newContent) => {
            setFiles(prev => {
              const updated = prev.map(f => 
                f.path.toLowerCase() === 'skill.md'
                  ? createTextFile(f.path, newContent)
                  : f
              )
              return updated
            })
          }}
          onClose={() => setShowAIIterateEditor(false)}
        />
      )}
    </div>
  )
}
