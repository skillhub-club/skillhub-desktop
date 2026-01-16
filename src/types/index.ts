export interface DetectedTool {
  name: string
  id: string
  config_path: string
  skills_path: string
  installed: boolean
  skills_count: number
}

export interface InstalledSkill {
  name: string
  path: string
  description?: string
  author?: string
  tool_id: string
}

export interface SkillHubSkill {
  id: string
  name: string
  slug: string
  description: string
  description_zh?: string
  author: string
  category: string
  simple_score?: number
  simple_rating?: string
  github_stars?: number
  repo_url: string
  skill_md_raw?: string
  tags?: string[]
}

export interface CatalogResponse {
  skills: SkillHubSkill[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface SearchResponse {
  skills: SkillHubSkill[]
  total: number
}

export type SortOption = 'popular' | 'recent' | 'score' | 'stars'

// Auth types
export interface User {
  id: string
  email?: string
  name?: string
  avatar_url?: string
  github_username?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
}

export interface FavoriteSkill {
  id: string
  skill_id: string
  skill: SkillHubSkill
  created_at: string
}

export interface SkillCollection {
  id: string
  name: string
  description?: string
  searchQuery?: string
  createdAt: string
  updatedAt: string
  skills: SkillHubSkill[]
}

// File tree types for Skills Explorer
export interface SkillFileMetadata {
  name?: string
  description?: string
  author?: string
  category?: string
}

export interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children?: FileNode[]
  content?: string
  metadata?: SkillFileMetadata
}
