import { invoke } from '@tauri-apps/api/core'
import type {
  DetectedTool,
  InstalledSkill,
  SkillHubSkill,
  CatalogResponse
} from '../types'

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
  sortBy?: string
): Promise<CatalogResponse> {
  return invoke('get_catalog', { page, limit, category, sortBy })
}

// Get skill detail from SkillHub API
export async function getSkillDetail(slug: string): Promise<SkillHubSkill> {
  const data = await invoke<{ skill: SkillHubSkill }>('get_skill_detail', { slug })
  return data.skill
}

// Fetch skill content (SKILL.md) for installation
export async function fetchSkillContent(slug: string): Promise<string> {
  const skill = await getSkillDetail(slug)
  return skill.skill_md_raw || ''
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

// Get the API base URL
function getApiBaseUrl(): string {
  // Use environment variable or default to production
  return import.meta.env.VITE_SKILLHUB_API_URL || 'https://skillhub.dev'
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
