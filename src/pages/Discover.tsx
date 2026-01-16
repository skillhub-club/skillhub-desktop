import { useState, useEffect } from 'react'
import { Search, Loader2, ExternalLink, ChevronDown, Zap } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { useAppStore } from '../store'
import { searchSkills, getCatalog, fetchSkillContent, installSkill, detectTools } from '../api/skillhub'
import SkillCard from '../components/SkillCard'
import SkillDetail from '../components/SkillDetail'
import ToolSelector from '../components/ToolSelector'
import type { SkillHubSkill } from '../types'

const SKILLHUB_URL = 'http://localhost:3000'
const PAGE_SIZE = 12

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'development', label: 'Development' },
  { id: 'devops', label: 'DevOps' },
  { id: 'testing', label: 'Testing' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'ai-ml', label: 'AI/ML' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'security', label: 'Security' },
]

export default function Discover() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    catalogSkills,
    setCatalogSkills,
    currentCategory,
    setCurrentCategory,
    selectedToolIds,
    tools,
    setTools,
    isLoading,
    setIsLoading,
    setToastMessage,
  } = useAppStore()

  const [showInstallModal, setShowInstallModal] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillHubSkill | null>(null)
  const [viewingSkill, setViewingSkill] = useState<SkillHubSkill | null>(null)
  const [installing, setInstalling] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  // Get installed tools for quick install
  const installedTools = tools.filter(t => t.installed)

  // Load catalog on mount and category change
  useEffect(() => {
    if (!searchQuery) {
      setCurrentPage(1)
      setIsLoading(true)
      getCatalog(1, PAGE_SIZE, currentCategory === 'all' ? undefined : currentCategory, 'popular')
        .then(data => {
          setCatalogSkills(data.skills || [])
          setTotalPages(data.pagination?.totalPages || 1)
        })
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [currentCategory, searchQuery, setCatalogSkills, setIsLoading])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      setIsLoading(true)
      searchSkills(searchQuery, PAGE_SIZE)
        .then(setSearchResults)
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, setSearchResults, setIsLoading])

  // Load more
  const handleLoadMore = async () => {
    if (loadingMore || currentPage >= totalPages) return

    setLoadingMore(true)
    try {
      const nextPage = currentPage + 1
      const data = await getCatalog(nextPage, PAGE_SIZE, currentCategory === 'all' ? undefined : currentCategory, 'popular')
      setCatalogSkills([...catalogSkills, ...(data.skills || [])])
      setCurrentPage(nextPage)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Failed to load more:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const openWebsite = async (path: string = '/skills') => {
    try {
      await open(`${SKILLHUB_URL}${path}`)
    } catch (error) {
      console.error('Failed to open browser:', error)
    }
  }

  const handleInstallClick = (skill: SkillHubSkill) => {
    setSelectedSkill(skill)
    setShowInstallModal(true)
  }

  // Quick install to all tools
  const handleQuickInstall = async (skill: SkillHubSkill) => {
    if (installedTools.length === 0) {
      setToastMessage('No AI tools detected')
      return
    }

    setInstalling(true)
    setSelectedSkill(skill)
    try {
      const content = await fetchSkillContent(skill.slug)
      if (!content) {
        throw new Error('Failed to fetch skill content')
      }

      const toolIds = installedTools.map(t => t.id)
      await installSkill(content, skill.name, toolIds)

      // Refresh tools to update counts
      const newTools = await detectTools()
      setTools(newTools)

      setToastMessage(`Installed "${skill.name}" to all ${installedTools.length} tool(s)`)
    } catch (error) {
      console.error('Install failed:', error)
      setToastMessage('Installation failed. Please try again.')
    } finally {
      setInstalling(false)
      setSelectedSkill(null)
    }
  }

  const handleInstall = async () => {
    if (!selectedSkill || selectedToolIds.length === 0) return

    setInstalling(true)
    try {
      const content = await fetchSkillContent(selectedSkill.slug)
      if (!content) {
        throw new Error('Failed to fetch skill content')
      }

      await installSkill(content, selectedSkill.name, selectedToolIds)

      // Refresh tools to update counts
      const newTools = await detectTools()
      setTools(newTools)

      setToastMessage(`Installed "${selectedSkill.name}" to ${selectedToolIds.length} tool(s)`)
      setShowInstallModal(false)
    } catch (error) {
      console.error('Install failed:', error)
      setToastMessage('Installation failed. Please try again.')
    } finally {
      setInstalling(false)
    }
  }

  const displayedSkills = searchQuery.trim() ? searchResults : catalogSkills
  const hasMore = !searchQuery && currentPage < totalPages

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Discover Skills</h1>
        <p className="text-gray-600">Browse and install AI coding skills from SkillHub</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search skills with AI... (e.g., 'React component generator')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>

      {/* Categories */}
      {!searchQuery && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCurrentCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                currentCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Skills Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : displayedSkills.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {searchQuery ? 'No skills found' : 'No skills available'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onInstall={handleInstallClick}
                onView={setViewingSkill}
                onQuickInstall={installedTools.length > 0 ? handleQuickInstall : undefined}
                installing={installing && selectedSkill?.id === skill.id}
              />
            ))}
          </div>

          {/* Load More / View on Website */}
          <div className="mt-8 text-center space-y-3">
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ChevronDown size={18} />
                )}
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            )}

            <div>
              <button
                onClick={() => openWebsite(searchQuery ? `/skills?q=${encodeURIComponent(searchQuery)}` : '/skills')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                <ExternalLink size={18} />
                {searchQuery
                  ? `View all results on SkillHub`
                  : 'Browse all skills on SkillHub'
                }
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Showing {displayedSkills.length} skills
              {!searchQuery && totalPages > 1 && ` (page ${currentPage} of ${totalPages})`}
            </p>
          </div>
        </>
      )}

      {/* Install Modal */}
      {showInstallModal && selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-2">Install Skill</h2>
            <p className="text-gray-600 mb-4">
              Installing <strong>{selectedSkill.name}</strong>
            </p>

            <ToolSelector />

            {/* Quick Install All Button */}
            {installedTools.length > 1 && (
              <button
                onClick={() => {
                  // Select all installed tools
                  const { selectAllTools } = useAppStore.getState()
                  selectAllTools()
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-200"
              >
                <Zap size={16} />
                Select All {installedTools.length} Tools
              </button>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInstallModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInstall}
                disabled={installing || selectedToolIds.length === 0}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installing ? 'Installing...' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Detail Modal */}
      {viewingSkill && (
        <SkillDetail
          skill={viewingSkill}
          onClose={() => setViewingSkill(null)}
        />
      )}
    </div>
  )
}
