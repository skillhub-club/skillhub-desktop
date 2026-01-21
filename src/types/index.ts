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
  skill_path?: string | null // Path within the repo for the skill directory
  tags?: string[]
  is_aggregator?: boolean
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

// Skill file tree types
export interface SkillFileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  children?: SkillFileNode[]
}

export interface SkillFilesResponse {
  skill_id: string
  repo_url: string
  skill_path: string | null
  branch: string
  tree: SkillFileNode[]
  stats: {
    total_files: number
    total_folders: number
    total_size: number
  }
}

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

// User Hosted Skills Types
export type SkillVisibility = 'public' | 'unlisted' | 'private'
export type SkillStatus = 'draft' | 'published' | 'archived'
export type FileKind = 'skill_md' | 'manifest' | 'script' | 'reference' | 'asset' | 'other'

export interface UserSkill {
  id: string
  name: string
  slug: string
  description: string
  description_zh?: string
  category: string
  tags: string[]
  visibility: SkillVisibility
  status: SkillStatus
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface UserSkillFile {
  filepath: string
  content?: string
  storagePath?: string
  kind: FileKind
  contentType: string
  size?: number
  hash?: string
}

export interface CreateUserSkillRequest {
  name: string
  description: string
  description_zh?: string
  category: string
  tags?: string[]
  visibility?: SkillVisibility
}

export interface UploadFilesRequest {
  files: UserSkillFile[]
  changeSummary?: string
}

export interface UploadUrlRequest {
  filepath: string
  contentType: string
  size: number
  kind: FileKind
}

export interface UploadUrlResponse {
  bucket: string
  storagePath: string
  uploadUrl: string
  expiresIn: number
}

export interface PublishSkillRequest {
  version: number
  changeSummary?: string
}

export interface SkillVersion {
  version: number
  changeSummary?: string
  createdAt: string
  publishedAt?: string
}

// Marketplace (user-hosted) skills
export type MarketplaceSortOption = 'published_at_desc' | 'updated_at_desc' | 'views_desc' | 'downloads_desc' | 'name_asc'

export interface MarketplaceSkill extends UserSkill {
  ownerName?: string
  ownerId?: string
  ownerAvatar?: string
  coverUrl?: string
  hasCover?: boolean
  downloads?: number
  views?: number
  published_at?: string
  updated_at?: string
}

export interface MarketplaceQuery {
  page?: number
  pageSize?: number
  q?: string
  category?: string
  tag?: string
  hasCover?: boolean
  sort?: MarketplaceSortOption
}

export interface MarketplaceResponse {
  skills: MarketplaceSkill[]
  page: number
  page_size: number
  total: number
}
