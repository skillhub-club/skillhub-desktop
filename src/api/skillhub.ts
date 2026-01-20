import { invoke } from '@tauri-apps/api/core'
import type {
  DetectedTool,
  InstalledSkill,
  SkillHubSkill,
  CatalogResponse,
  SkillFilesResponse
} from '../types'

// Get the API base URL
function getApiBaseUrl(): string {
  return import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'
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
  return invoke('search_skills', { query, limit })
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
  const rootPath = basePath || path
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
            const relativePath = item.path.startsWith(rootPath + '/')
              ? item.path.slice(rootPath.length + 1)
              : item.name
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
  const path = skillPath || parsed.skillPath || ''
  console.log('[fetchSkillFilesFromGitHub] Fetching from:', parsed.owner, parsed.repo, path)
  return fetchGitHubDirectory(parsed.owner, parsed.repo, path)
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
    } catch (error) {
      console.error('[smartInstallSkill] GitHub fetch failed:', error)
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
