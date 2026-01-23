import { invoke } from '@tauri-apps/api/core'
import type {
  DetectedTool,
  InstalledSkill,
  SkillHubSkill,
  CatalogResponse,
  SkillFilesResponse,
  UserSkill,
  UserSkillFile,
  CreateUserSkillRequest,
  UploadFilesRequest,
  UploadUrlRequest,
  UploadUrlResponse,
  PublishSkillRequest,
  SkillVersion,
  SkillVisibility,
  SkillStatus,
  MarketplaceQuery,
  MarketplaceResponse,
  MarketplaceSkill
} from '../types'

// Get the API base URL
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_SKILLHUB_API_URL
  const defaultUrl = 'https://www.skillhub.club'

  // In web dev (vite preview), hitting a localhost API with another localhost origin will fail CORS.
  // If we're not in a Tauri environment and the env is localhost but on a different origin, fall back to prod.
  if (typeof window !== 'undefined') {
    const isTauri = '__TAURI__' in window
    const isLocalEnv = envUrl?.includes('localhost') || envUrl?.includes('127.0.0.1')
    const sameOrigin = envUrl?.startsWith(window.location.origin)
    if (!isTauri && isLocalEnv && !sameOrigin) {
      return defaultUrl
    }
  }

  return envUrl || defaultUrl
}

// ============ Cache System ============
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Clear cache for a specific prefix or all
export function clearCache(prefix?: string): void {
  if (prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
  console.log('[Cache] Cleared:', prefix || 'all')
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { skillhubCache: { clear: typeof clearCache; list: () => string[] } }).skillhubCache = {
    clear: clearCache,
    list: () => Array.from(cache.keys()),
  }
}

// Detect all supported AI coding tools on the system
export async function detectTools(): Promise<DetectedTool[]> {
  return invoke('detect_tools')
}

// Get installed skills for a specific tool
export async function getInstalledSkills(toolId: string): Promise<InstalledSkill[]> {
  return invoke('get_installed_skills', { toolId })
}

// Install a skill to specified tools
export async function installSkill(
  skillContent: string,
  skillName: string,
  toolIds: string[]
): Promise<string[]> {
  return invoke('install_skill', { skillContent, skillName, toolIds })
}

// Uninstall a skill
export async function uninstallSkill(skillPath: string): Promise<void> {
  return invoke('uninstall_skill', { skillPath })
}

// Read skill content from path (for syncing)
export async function readSkillContent(skillPath: string): Promise<string> {
  return invoke('read_skill_content', { skillPath })
}

// Search skills using SkillHub API
export async function searchSkills(
  query: string,
  limit?: number
): Promise<SkillHubSkill[]> {
  const results: SkillHubSkill[] = await invoke('search_skills', { query, limit })

  // Deduplicate by slug, keeping the one with highest github_stars
  const uniqueBySlug = new Map<string, SkillHubSkill>()
  for (const skill of results) {
    const existing = uniqueBySlug.get(skill.slug)
    if (!existing || (skill.github_stars || 0) > (existing.github_stars || 0)) {
      uniqueBySlug.set(skill.slug, skill)
    }
  }

  return Array.from(uniqueBySlug.values())
}

// Get skill catalog from SkillHub API
export async function getCatalog(
  page?: number,
  limit?: number,
  category?: string,
  sortBy?: string,
  type?: string // "collections" for aggregator repos
): Promise<CatalogResponse> {
  return invoke('get_catalog', { page, limit, category, sortBy, type })
}

// KOL API response type
export interface KolUser {
  id: string
  githubUsername: string
  displayName: string
  avatarUrl?: string
  bio?: string | null
  githubFollowers: number
  skillCount: number
  twitterHandle?: string | null
  kolVerifiedAt?: string
}

export interface KolResponse {
  kols: KolUser[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

// Get KOL list with caching
export async function getKolList(
  limit = 20,
  offset = 0,
  sort: 'followers' | 'skills' | 'newest' = 'followers'
): Promise<KolResponse> {
  const cacheKey = `kol:${limit}:${offset}:${sort}`

  // Check cache first
  const cached = getCached<KolResponse>(cacheKey)
  if (cached) {
    console.log('[getKolList] Cache hit:', cacheKey)
    return cached
  }

  console.log('[getKolList] Cache miss, calling invoke with:', { limit, offset, sort })
  const data: KolResponse = await invoke('get_kol_list', { limit, offset, sort })
  console.log('[getKolList] Received data:', data)

  // Cache the result
  setCache(cacheKey, data)

  return data
}

// KOL detail response type
export interface KolDetailResponse {
  user: {
    id: string
    githubUsername: string
    displayName: string
    avatarUrl?: string
    bio?: string | null
    githubFollowers: number
    isKol: boolean
    stats: {
      totalSkills: number
      totalStars: number
    }
  }
  skills: SkillHubSkill[]
  pagination: {
    total: number
    limit: number
    hasMore: boolean
  }
}

// Get KOL detail with skills
export async function getKolDetail(
  username: string,
  includeSkills = true,
  skillsLimit = 20
): Promise<KolDetailResponse> {
  const cacheKey = `kol-detail:${username}:${includeSkills}:${skillsLimit}`

  const cached = getCached<KolDetailResponse>(cacheKey)
  if (cached) {
    console.log('[getKolDetail] Cache hit:', cacheKey)
    return cached
  }

  console.log('[getKolDetail] Fetching:', username)
  const data: KolDetailResponse = await invoke('get_kol_detail', {
    username,
    include_skills: includeSkills,
    skills_limit: skillsLimit
  })

  setCache(cacheKey, data)
  return data
}

// Get skill detail from SkillHub API
export async function getSkillDetail(slug: string): Promise<SkillHubSkill> {
  const data = await invoke<{ skill: SkillHubSkill }>('get_skill_detail', { slug })
  return data.skill
}

// GitHub file type
export interface GitHubFile {
  path: string
  content: string
}

// Parse repo URL to get owner, repo, and optional skill path
// Supports formats like:
// - https://github.com/owner/repo
// - https://github.com/owner/repo#skills~skill-name (skill path in hash)
// - https://github.com/owner/repo/tree/main/path/to/skill
function parseRepoUrl(repoUrl: string): { owner: string; repo: string; skillPath?: string } | null {
  // First, extract skill path from hash (e.g., #skills~skill-name -> skills/skill-name)
  let skillPath: string | undefined
  const hashMatch = repoUrl.match(/#(.+)$/)
  if (hashMatch) {
    // Convert ~ to / for path (e.g., "skills~skill-creator" -> "skills/skill-creator")
    skillPath = hashMatch[1].replace(/~/g, '/')
    repoUrl = repoUrl.replace(/#.+$/, '') // Remove hash from URL
  }

  // Parse owner and repo
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#]+)/)
  if (!match) return null
  
  return { 
    owner: match[1], 
    repo: match[2].replace(/\.git$/, ''),
    skillPath 
  }
}

// Recursively fetch all files from a GitHub directory
export async function fetchGitHubDirectory(
  owner: string,
  repo: string,
  path: string,
  branch = 'main',
  basePath?: string
): Promise<GitHubFile[]> {
  const rootPath = basePath !== undefined ? basePath : path
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  
  try {
    const res = await fetch(apiUrl)
    if (!res.ok) {
      // Try master branch if main fails
      if (branch === 'main') {
        return fetchGitHubDirectory(owner, repo, path, 'master', basePath)
      }
      return []
    }

    const items = await res.json()
    const files: GitHubFile[] = []

    for (const item of items) {
      if (item.type === 'file') {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`
        try {
          const fileRes = await fetch(rawUrl)
          if (fileRes.ok) {
            const content = await fileRes.text()
            // Get relative path from the root skill folder
            const relativePath = rootPath
              ? item.path.startsWith(rootPath + '/')
                ? item.path.slice(rootPath.length + 1)
                : item.name
              : item.path
            files.push({ path: relativePath, content })
          }
        } catch {
          // Skip failed files
        }
      } else if (item.type === 'dir') {
        const subFiles = await fetchGitHubDirectory(owner, repo, item.path, branch, rootPath)
        files.push(...subFiles)
      }
    }

    return files
  } catch {
    return []
  }
}

// Fetch all files for a skill from GitHub
export async function fetchSkillFilesFromGitHub(
  repoUrl: string,
  skillPath?: string | null
): Promise<GitHubFile[]> {
  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) return []

  // Use skillPath from argument, or from URL hash, or empty string
  const rawPath = skillPath || parsed.skillPath || ''
  const path = rawPath.replace(/^\/+/, '')
  const fallbackPath = path && !path.includes('/') && path.startsWith('skills-')
    ? `skills/${path.replace(/^skills-/, '')}`
    : ''

  console.log('[fetchSkillFilesFromGitHub] Fetching from:', parsed.owner, parsed.repo, path)
  const files = await fetchGitHubDirectory(parsed.owner, parsed.repo, path)
  if (files.length > 0) return files

  if (fallbackPath) {
    console.log('[fetchSkillFilesFromGitHub] Fallback path:', fallbackPath)
    return fetchGitHubDirectory(parsed.owner, parsed.repo, fallbackPath)
  }

  return []
}

// Fetch skill content (SKILL.md) for installation
export async function fetchSkillContent(slug: string): Promise<string> {
  const skill = await getSkillDetail(slug)
  return skill.skill_md_raw || ''
}

// Install multiple files for a skill (supports multi-file skills)
export async function installSkillFiles(
  files: GitHubFile[],
  skillName: string,
  toolIds: string[]
): Promise<string[]> {
  // Convert GitHubFile[] to [path, content][] for Rust
  const filesTuples: [string, string][] = files.map(f => [f.path, f.content])
  return invoke('install_skill_files', { files: filesTuples, skillName, toolIds })
}

// Install multiple files for a skill to a specific project directory
export async function installSkillFilesToProject(
  files: GitHubFile[],
  skillName: string,
  projectPath: string,
  toolId: string
): Promise<string> {
  const filesTuples: [string, string][] = files.map(f => [f.path, f.content])
  return invoke('install_skill_files_to_project', { files: filesTuples, skillName, projectPath, toolId })
}

// Smart install that uses GitHub direct download for multi-file skills
// Falls back to skill_md_raw for single-file skills
export async function smartInstallSkill(
  skill: { 
    name: string
    slug: string
    repo_url?: string
    skill_path?: string | null
    skill_md_raw?: string 
  },
  toolIds: string[]
): Promise<void> {
  // Create a safe folder name from skill name
  const folderName = skill.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() || skill.slug.split('-').slice(-1)[0] || 'skill'

  console.log('[smartInstallSkill] Installing:', skill.name, 'to folder:', folderName)
  console.log('[smartInstallSkill] repo_url:', skill.repo_url)

  // Try to fetch all files from GitHub directly
  if (skill.repo_url) {
    try {
      const files = await fetchSkillFilesFromGitHub(skill.repo_url, skill.skill_path)
      console.log('[smartInstallSkill] Fetched files:', files.length)
      
      if (files.length > 0) {
        // Normalize file paths - ensure SKILL.md is at root with correct case
        const normalizedFiles = files.map(f => {
          let path = f.path
          if (path.toLowerCase() === 'skill.md') {
            path = 'SKILL.md'
          }
          return { path, content: f.content }
        })
        
        console.log('[smartInstallSkill] Installing files:', normalizedFiles.map(f => f.path))
        await installSkillFiles(normalizedFiles, folderName, toolIds)
        return
      }
      throw new Error('GitHub repo returned no files')
    } catch (error) {
      console.error('[smartInstallSkill] GitHub fetch failed:', error)
      throw error instanceof Error ? error : new Error('GitHub fetch failed')
    }
  }

  // Fallback: get full skill detail and use skill_md_raw
  console.log('[smartInstallSkill] Falling back to skill_md_raw')
  let skillMdRaw = skill.skill_md_raw
  
  if (!skillMdRaw) {
    // Fetch full skill detail to get skill_md_raw
    const fullSkill = await getSkillDetail(skill.slug)
    skillMdRaw = fullSkill.skill_md_raw
  }
  
  if (skillMdRaw) {
    await installSkill(skillMdRaw, folderName, toolIds)
    return
  }

  throw new Error('No skill content available')
}

// Smart install to project directory (multi-file supported)
export async function smartInstallSkillToProject(
  skill: { 
    name: string
    slug: string
    repo_url?: string
    skill_path?: string | null
    skill_md_raw?: string 
  },
  projectPath: string,
  toolIds: string[]
): Promise<void> {
  const folderName = skill.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() || skill.slug.split('-').slice(-1)[0] || 'skill'

  if (skill.repo_url) {
    try {
      const files = await fetchSkillFilesFromGitHub(skill.repo_url, skill.skill_path)
      if (files.length > 0) {
        const normalizedFiles = files.map(f => {
          let path = f.path
          if (path.toLowerCase() === 'skill.md') {
            path = 'SKILL.md'
          }
          return { path, content: f.content }
        })

        for (const toolId of toolIds) {
          await installSkillFilesToProject(normalizedFiles, folderName, projectPath, toolId)
        }
        return
      }
      throw new Error('GitHub repo returned no files')
    } catch (error) {
      console.error('[smartInstallSkillToProject] GitHub fetch failed:', error)
      throw error instanceof Error ? error : new Error('GitHub fetch failed')
    }
  }

  let skillMdRaw = skill.skill_md_raw
  if (!skillMdRaw) {
    const fullSkill = await getSkillDetail(skill.slug)
    skillMdRaw = fullSkill.skill_md_raw
  }

  if (skillMdRaw) {
    for (const toolId of toolIds) {
      await invoke('install_skill_to_project', {
        skillContent: skillMdRaw,
        skillName: folderName,
        projectPath,
        toolId,
      })
    }
    return
  }

  throw new Error('No skill content available')
}

// Get skill file tree structure
export async function getSkillFiles(skillId: string): Promise<SkillFilesResponse> {
  return invoke('get_skill_files', { skillId })
}

// Get file content from GitHub (proxied through Rust backend)
export async function getFileContent(rawUrl: string): Promise<string> {
  return invoke('get_remote_file_content', { rawUrl })
}

// Build raw GitHub URL for a file
export function buildRawGitHubUrl(repoUrl: string, branch: string, filePath: string, skillPath?: string | null): string {
  // Convert https://github.com/owner/repo to https://raw.githubusercontent.com/owner/repo/branch/path
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  
  const [, owner, repo] = match
  const cleanRepo = repo.replace(/\.git$/, '')
  const fullPath = skillPath ? `${skillPath}/${filePath}` : filePath
  
  return `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/${fullPath}`
}

// AI Skill Generation Types
export interface GenerateSkillRequest {
  description: string
  category?: string
  context?: {
    tool?: string
    language?: string
  }
}

export interface GenerateSkillEvent {
  type: 'start' | 'content' | 'done' | 'error'
  generation_id?: string
  text?: string
  message?: string
  usage?: {
    daily_remaining: number
  }
}

export interface TrackGenerationRequest {
  generation_id: string
  event: 'used' | 'modified' | 'discarded'
  data?: {
    original_content?: string
    final_content?: string
    modification_ratio?: number
    tool_used?: string
  }
}

// Generate skill using AI (SSE streaming)
export async function generateSkill(
  accessToken: string,
  request: GenerateSkillRequest,
  onEvent: (event: GenerateSkillEvent) => void
): Promise<void> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/v1/desktop/generate-skill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error_description || error.error || 'Failed to generate skill')
  }

  // Handle SSE stream
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process SSE events
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          const event = JSON.parse(data) as GenerateSkillEvent
          onEvent(event)
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  }
}

// Track generation usage
export async function trackGeneration(
  accessToken: string,
  request: TrackGenerationRequest
): Promise<void> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/v1/desktop/track-generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error_description || error.error || 'Failed to track generation')
  }
}

// AI Text Enhancement Types
export type EnhanceType = 'expand' | 'simplify' | 'rewrite' | 'translate'

export interface EnhanceTextRequest {
  text: string
  type: EnhanceType
  context?: string
}

export interface EnhanceTextEvent {
  type: 'start' | 'content' | 'done' | 'error'
  text?: string
  message?: string
}

// Enhance text using AI (SSE streaming)
export async function enhanceText(
  accessToken: string,
  request: EnhanceTextRequest,
  onEvent: (event: EnhanceTextEvent) => void
): Promise<void> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/v1/desktop/enhance-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error_description || error.error || 'Failed to enhance text')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as EnhanceTextEvent
          onEvent(event)
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  }
}

// ============ User Hosted Skills API ============

// Create a new skill (draft)
export async function createUserSkill(
  accessToken: string,
  request: CreateUserSkillRequest
): Promise<UserSkill> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create skill' }))
    throw new Error(error.error || error.message || 'Failed to create skill')
  }

  return response.json()
}

// List user's skills
export async function listUserSkills(
  accessToken: string,
  options?: { status?: SkillStatus; visibility?: SkillVisibility }
): Promise<UserSkill[]> {
  const baseUrl = getApiBaseUrl()
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.visibility) params.set('visibility', options.visibility)

  const url = `${baseUrl}/api/user/skills${params.toString() ? '?' + params.toString() : ''}`
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to list skills' }))
    throw new Error(error.error || error.message || 'Failed to list skills')
  }

  return response.json()
}

// Get skill detail
export async function getUserSkillDetail(
  accessToken: string,
  skillId: string
): Promise<UserSkill> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get skill' }))
    throw new Error(error.error || error.message || 'Failed to get skill')
  }

  return response.json()
}

// Update skill metadata
export async function updateUserSkill(
  accessToken: string,
  skillId: string,
  updates: Partial<CreateUserSkillRequest>
): Promise<UserSkill> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update skill' }))
    throw new Error(error.error || error.message || 'Failed to update skill')
  }

  return response.json()
}

// Upload/update files and generate new version
export async function uploadSkillFiles(
  accessToken: string,
  skillId: string,
  request: UploadFilesRequest
): Promise<{ version: number }> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to upload files' }))
    throw new Error(error.error || error.message || 'Failed to upload files')
  }

  return response.json()
}

// Get upload URL for large files
export async function getUploadUrl(
  accessToken: string,
  skillId: string,
  request: UploadUrlRequest
): Promise<UploadUrlResponse> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get upload URL' }))
    throw new Error(error.error || error.message || 'Failed to get upload URL')
  }

  return response.json()
}

// Publish a version
export async function publishSkill(
  accessToken: string,
  skillId: string,
  request: PublishSkillRequest
): Promise<UserSkill> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to publish skill' }))
    throw new Error(error.error || error.message || 'Failed to publish skill')
  }

  return response.json()
}

// Set visibility
export async function setSkillVisibility(
  accessToken: string,
  skillId: string,
  visibility: SkillVisibility
): Promise<UserSkill> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}/visibility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ visibility }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to set visibility' }))
    throw new Error(error.error || error.message || 'Failed to set visibility')
  }

  return response.json()
}

// Get version list
export async function getSkillVersions(
  accessToken: string,
  skillId: string
): Promise<SkillVersion[]> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}/versions`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get versions' }))
    throw new Error(error.error || error.message || 'Failed to get versions')
  }

  return response.json()
}

// Get files for a specific version
export async function getSkillFilesForVersion(
  accessToken: string,
  skillId: string,
  version?: number
): Promise<UserSkillFile[]> {
  const baseUrl = getApiBaseUrl()
  const params = version ? `?version=${version}` : ''
  const response = await fetch(`${baseUrl}/api/user/skills/${skillId}/files${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get files' }))
    throw new Error(error.error || error.message || 'Failed to get files')
  }

  return response.json()
}

// Get public marketplace skills (requires auth)
export async function listMarketplaceSkills(
  accessToken: string,
  options?: MarketplaceQuery
): Promise<MarketplaceResponse> {
  const baseUrl = getApiBaseUrl()
  const params = new URLSearchParams()
  if (options?.page) params.set('page', options.page.toString())
  if (options?.pageSize) params.set('page_size', options.pageSize.toString())
  if (options?.q) params.set('q', options.q)
  if (options?.category) params.set('category', options.category)
  if (options?.tag) params.set('tag', options.tag)
  if (options?.hasCover !== undefined) params.set('has_cover', String(options.hasCover))
  if (options?.sort) params.set('sort', options.sort)

  const query = params.toString()
  const url = `${baseUrl}/api/user/skills/public${query ? `?${query}` : ''}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to load marketplace' }))
    throw new Error(error.error || error.message || 'Failed to load marketplace')
  }

  const data: MarketplaceResponse = await response.json()

  // Normalize cover / owner fields to camelCase for UI convenience
  const skills = (data.skills || []).map((skill: MarketplaceSkill) => ({
    ...skill,
    coverUrl: (skill as unknown as { cover_url?: string }).cover_url || skill.coverUrl,
    ownerName: (skill as unknown as { owner_name?: string }).owner_name || skill.ownerName,
    ownerId: (skill as unknown as { owner_id?: string }).owner_id || skill.ownerId,
    ownerAvatar: (skill as unknown as { owner_avatar?: string }).owner_avatar || skill.ownerAvatar,
  }))

  return {
    ...data,
    skills,
  }
}
