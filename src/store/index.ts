import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DetectedTool, InstalledSkill, SkillHubSkill, User, FavoriteSkill, SkillCollection } from '../types'

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number // timestamp in ms
}

interface AppState {
  // Auth
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: number | null // timestamp in ms
  favorites: FavoriteSkill[]
  collections: SkillCollection[]
  login: (user: User, tokens: TokenData) => void
  updateTokens: (accessToken: string, expiresAt: number) => void
  logout: () => void
  setFavorites: (favorites: FavoriteSkill[]) => void
  setCollections: (collections: SkillCollection[]) => void

  // Tools
  tools: DetectedTool[]
  selectedToolIds: string[]
  setTools: (tools: DetectedTool[]) => void
  toggleToolSelection: (toolId: string) => void
  selectAllTools: () => void

  // Installed skills
  installedSkills: Record<string, InstalledSkill[]>
  setInstalledSkills: (toolId: string, skills: InstalledSkill[]) => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SkillHubSkill[]
  setSearchResults: (results: SkillHubSkill[]) => void

  // Catalog
  catalogSkills: SkillHubSkill[]
  setCatalogSkills: (skills: SkillHubSkill[]) => void
  currentCategory: string
  setCurrentCategory: (category: string) => void

  // UI state
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  toastMessage: string | null
  setToastMessage: (message: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      favorites: [],
      collections: [],
      login: (user, tokens) => set({
        isAuthenticated: true,
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      }),
      updateTokens: (accessToken, expiresAt) => set({ accessToken, tokenExpiresAt: expiresAt }),
      logout: () => set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        favorites: [],
        collections: []
      }),
      setFavorites: (favorites) => set({ favorites }),
      setCollections: (collections) => set({ collections }),

      // Tools
      tools: [],
      selectedToolIds: [],
      setTools: (tools) => set({ tools }),
      toggleToolSelection: (toolId) => set((state) => ({
        selectedToolIds: state.selectedToolIds.includes(toolId)
          ? state.selectedToolIds.filter(id => id !== toolId)
          : [...state.selectedToolIds, toolId]
      })),
      selectAllTools: () => set((state) => ({
        selectedToolIds: state.tools.filter(t => t.installed).map(t => t.id)
      })),

      // Installed skills
      installedSkills: {},
      setInstalledSkills: (toolId, skills) => set((state) => ({
        installedSkills: { ...state.installedSkills, [toolId]: skills }
      })),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),

      // Catalog
      catalogSkills: [],
      setCatalogSkills: (skills) => set({ catalogSkills: skills }),
      currentCategory: 'all',
      setCurrentCategory: (category) => set({ currentCategory: category }),

      // UI state
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      toastMessage: null,
      setToastMessage: (message) => set({ toastMessage: message }),
    }),
    {
      name: 'skillhub-desktop-storage',
      partialize: (state) => ({
        // Auth (persisted)
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        favorites: state.favorites,
        collections: state.collections,
        // Preferences (persisted)
        selectedToolIds: state.selectedToolIds,
        currentCategory: state.currentCategory,
      }),
    }
  )
)
