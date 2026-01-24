import { useState, useEffect } from 'react'
import { Search, Loader2, ExternalLink, ChevronDown, ArrowUpDown, X, Users, Star, CheckSquare, LayoutGrid, List } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { searchSkills, getCatalog, smartInstallSkill, smartInstallSkillToProject, detectTools, getKolList, type KolUser } from '../api/skillhub'
import SkillCard from '../components/SkillCard'
import SkillDetail from '../components/SkillDetail'
import KolDetail from '../components/KolDetail'
import ToolSelector from '../components/ToolSelector'
import BatchActionBar from '../components/BatchActionBar'
import type { SkillHubSkill } from '../types'


const SKILLHUB_URL = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'
const PAGE_SIZE = 12

export default function Discover() {
  const { t } = useTranslation()
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    catalogSkills,
    setCatalogSkills,
    currentCategory,
    setCurrentCategory,
    currentSortBy,
    setCurrentSortBy,
    discoverPage,
    setDiscoverPage,
    discoverTotalPages,
    setDiscoverTotalPages,
    discoverLastCategory,
    discoverLastSortBy,
    setDiscoverLastParams,
    selectedToolIds,
    tools,
    setTools,
    isLoading,
    setIsLoading,
    showToast,
    // Multi-select
    selectedSkillIds,
    selectionMode,
    toggleSkillSelection,
    setSelectionMode,
    clearSkillSelection,
  } = useAppStore()

  const CATEGORIES = [
    { id: 'all', label: t('discover.categories.all') },
    { id: 'collections', label: t('discover.categories.collections') },
    { id: 'kol', label: t('discover.categories.kol') },
    { id: 'development', label: t('discover.categories.development') },
    { id: 'devops', label: t('discover.categories.devops') },
    { id: 'testing', label: t('discover.categories.testing') },
    { id: 'documentation', label: t('discover.categories.documentation') },
    { id: 'ai-ml', label: t('discover.categories.aiMl') },
    { id: 'frontend', label: t('discover.categories.frontend') },
    { id: 'backend', label: t('discover.categories.backend') },
    { id: 'security', label: t('discover.categories.security') },
  ]

  const SORT_OPTIONS = [
    { id: 'popular', label: t('discover.sort.popular') },
    { id: 'newest', label: t('discover.sort.newest') },
    { id: 'stars', label: t('discover.sort.stars') },
    { id: 'name', label: t('discover.sort.nameAz') },
  ]

  const [showInstallModal, setShowInstallModal] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillHubSkill | null>(null)
  const [viewingSkill, setViewingSkill] = useState<SkillHubSkill | null>(null)
  const [installing, setInstalling] = useState(false)

  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false)

  // KOL state
  const [kolList, setKolList] = useState<KolUser[]>([])
  const [kolLoading, setKolLoading] = useState(false)
  const [viewingKol, setViewingKol] = useState<KolUser | null>(null)

  // View mode state - default to list for better scannability
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Get installed tools for quick install
  const installedTools = tools.filter(t => t.installed)

  // Handle skill selection in multi-select mode
  const handleSkillSelect = (skill: SkillHubSkill) => {
    toggleSkillSelection(skill.id)
  }

  // Load catalog on mount and category/sort change
  useEffect(() => {
    if (!searchQuery) {
      const sameParams =
        discoverLastCategory === currentCategory && discoverLastSortBy === currentSortBy

      if (catalogSkills.length > 0 && sameParams) {
        return
      }

      setDiscoverPage(1)

      // Special handling for KOL category
      if (currentCategory === 'kol') {
        setKolLoading(true)
        getKolList(20, 0, 'followers')
          .then(data => {
            setKolList(data.kols || [])
          })
          .catch((error) => {
            console.error('Failed to load KOL list:', error)
            showToast(t('discover.failedToLoadKols'), 'error')
          })
          .finally(() => setKolLoading(false))
        return
      }

      setIsLoading(true)

      // 如果选择了 collections 分类，传递 type 参数
      const categoryParam = currentCategory === 'all' || currentCategory === 'collections'
        ? undefined
        : currentCategory
      const typeParam = currentCategory === 'collections' ? 'collections' : undefined

      getCatalog(1, PAGE_SIZE, categoryParam, currentSortBy, typeParam)
        .then(data => {
          setCatalogSkills(data.skills || [])
          setDiscoverTotalPages(data.pagination?.totalPages || 1)
          setDiscoverLastParams(currentCategory, currentSortBy)
        })
        .catch((error) => {
          console.error('Failed to load catalog:', error)
          showToast(t('discover.failedToLoadCatalog'), 'error')
        })
        .finally(() => setIsLoading(false))
    }
  }, [
    currentCategory,
    searchQuery,
    currentSortBy,
    catalogSkills.length,
    discoverLastCategory,
    discoverLastSortBy,
    setCatalogSkills,
    setDiscoverLastParams,
    setDiscoverPage,
    setDiscoverTotalPages,
    setIsLoading,
    showToast,
  ])

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
        .catch((error) => {
          console.error('Search failed:', error)
          showToast(t('discover.searchFailed'), 'error')
        })
        .finally(() => setIsLoading(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, setSearchResults, setIsLoading, showToast])

  // Load more
  const handleLoadMore = async () => {
    if (loadingMore || discoverPage >= discoverTotalPages) return

    setLoadingMore(true)
    try {
      const nextPage = discoverPage + 1
      const data = await getCatalog(nextPage, PAGE_SIZE, currentCategory === 'all' ? undefined : currentCategory, currentSortBy)
      setCatalogSkills([...catalogSkills, ...(data.skills || [])])
      setDiscoverPage(nextPage)
      setDiscoverTotalPages(data.pagination?.totalPages || 1)
      setDiscoverLastParams(currentCategory, currentSortBy)
    } catch (error) {
      console.error('Failed to load more:', error)
      showToast(t('discover.loadMoreFailed'), 'error')
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
    // 默认全选所有已安装的工具
    if (installedTools.length > 0) {
      const { selectAllTools } = useAppStore.getState()
      selectAllTools()
    }
    setSelectedSkill(skill)
    setShowInstallModal(true)
  }

  const handleInstall = async () => {
    if (installing) return
    if (!selectedSkill || selectedToolIds.length === 0) return

    const { installTarget, projectPath } = useAppStore.getState()
    
    // Validate project path if installing to project
    if (installTarget === 'project' && !projectPath) {
      showToast(t('discover.selectProjectFirst'), 'warning')
      return
    }

    setInstalling(true)
    try {
      if (installTarget === 'project' && projectPath) {
        await smartInstallSkillToProject(selectedSkill, projectPath, selectedToolIds)
        showToast(t('discover.installedToProject', { name: selectedSkill.name }), 'success')
      } else {
        // Install to personal (global) directory using smart install
        await smartInstallSkill(selectedSkill, selectedToolIds)
        showToast(t('discover.installedToTools', { name: selectedSkill.name, count: selectedToolIds.length }), 'success')
      }

      // Refresh tools to update counts
      const newTools = await detectTools()
      setTools(newTools)

      setShowInstallModal(false)
    } catch (error) {
      console.error('Install failed:', error)
      showToast(t('discover.installFailed'), 'error')
    } finally {
      setInstalling(false)
    }
  }

  const displayedSkills = searchQuery.trim() ? searchResults : catalogSkills
  const hasMore = !searchQuery && discoverPage < discoverTotalPages

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
          {t('discover.title').toUpperCase()}
        </h1>
        <p className="text-muted-foreground">{t('discover.subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder={t('discover.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-12"
        />
      </div>

      {/* Categories & Sort */}
      {!searchQuery && (
        <div className="space-y-4 mb-6">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategory(cat.id)}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2 ${
                  currentCategory === cat.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-border-light hover:border-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          
          {/* Sort + View Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ArrowUpDown size={14} />
                {t('discover.sortBy')}
              </span>
              <div className="flex gap-2">
                {SORT_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCurrentSortBy(option.id)}
                    className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all border ${
                      currentSortBy === option.id
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border-light hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode & Selection Controls */}
            <div className="flex items-center gap-2">
              {/* Multi-select toggle */}
              <button
                onClick={() => {
                  if (selectionMode) {
                    clearSkillSelection()
                  } else {
                    setSelectionMode(true)
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all border ${
                  selectionMode
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border-light hover:border-foreground hover:text-foreground'
                }`}
                title={selectionMode ? t('discover.exitSelectionMode') : t('discover.enterSelectionMode')}
              >
                <CheckSquare size={14} />
                {t('discover.select')}
              </button>

              {/* View mode toggle */}
              <div className="flex border border-border-light">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={t('discover.gridView')}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={t('discover.listView')}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KOL Grid - Special rendering for KOL category */}
      {currentCategory === 'kol' && !searchQuery ? (
        kolLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-foreground" size={32} />
          </div>
        ) : kolList.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {t('discover.noKols')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kolList.map(kol => (
                <div
                  key={kol.id}
                  className="border-2 border-border-light hover:border-foreground transition-all p-4 cursor-pointer"
                  onClick={() => setViewingKol(kol)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {kol.avatarUrl ? (
                      <img
                        src={kol.avatarUrl}
                        alt={kol.displayName}
                        className="w-12 h-12 border-2 border-foreground"
                      />
                    ) : (
                      <div className="w-12 h-12 border-2 border-foreground flex items-center justify-center bg-secondary">
                        <Users size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{kol.displayName}</h3>
                      <p className="text-sm text-muted-foreground truncate">@{kol.githubUsername}</p>
                    </div>
                  </div>
                  {kol.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{kol.bio}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {kol.githubFollowers.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={12} />
                      {t('discover.skillsCount', { count: kol.skillCount })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => openWebsite('/kol')}
                className="btn btn-secondary"
              >
                <ExternalLink size={18} />
                {t('discover.viewAllKols')}
              </button>
              <p className="mt-4 text-sm text-muted-foreground uppercase tracking-wider">
                {t('discover.kolCount', { count: kolList.length })}
              </p>
            </div>
          </>
        )
      ) : (
        /* Skills Grid */
        isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-foreground" size={32} />
          </div>
        ) : displayedSkills.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {searchQuery ? t('discover.noSkillsFound') : t('discover.noSkillsAvailable')}
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedSkills.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onInstall={handleInstallClick}
                    onView={setViewingSkill}
                    installing={installing && selectedSkill?.id === skill.id}
                    selectionMode={selectionMode}
                    selected={selectedSkillIds.includes(skill.id)}
                    onSelect={handleSkillSelect}
                  />
                ))}
              </div>
            ) : (
              /* List View */
              <div className="space-y-2">
                {displayedSkills.map(skill => (
                  <div
                    key={skill.id}
                    className={`flex items-center gap-4 p-4 border-2 transition-all cursor-pointer ${
                      selectedSkillIds.includes(skill.id)
                        ? 'border-foreground bg-secondary/50'
                        : 'border-border-light hover:border-foreground'
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        handleSkillSelect(skill)
                      } else {
                        setViewingSkill(skill)
                      }
                    }}
                  >
                    {/* Selection checkbox in list view */}
                    {selectionMode && (
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                          selectedSkillIds.includes(skill.id)
                            ? 'bg-foreground text-background'
                            : 'border-2 border-muted-foreground'
                        }`}
                      >
                        {selectedSkillIds.includes(skill.id) && (
                          <CheckSquare size={14} />
                        )}
                      </div>
                    )}
                    
                    {/* Skill info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground truncate">{skill.name}</h3>
                        {skill.simple_rating && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            skill.simple_rating === 'S' ? 'bg-yellow-500 text-black' :
                            skill.simple_rating === 'A' ? 'bg-purple-500 text-white' :
                            'bg-blue-500 text-white'
                          }`}>
                            {skill.simple_rating}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {t('discover.byAuthor', { name: skill.author })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{skill.description}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {skill.github_stars !== undefined && skill.github_stars > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star size={12} className="text-yellow-500" />
                          {skill.github_stars.toLocaleString()}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-xs bg-secondary text-muted-foreground">
                        {skill.category}
                      </span>
                      {!selectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleInstallClick(skill)
                          }}
                          className="px-3 py-1 text-xs font-semibold uppercase bg-foreground text-background hover:opacity-90 transition-colors"
                        >
                          {t('discover.install')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More / View on Website */}
            <div className="mt-8 text-center space-y-4">
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                  {loadingMore ? t('discover.loading') : t('discover.loadMore')}
                </button>
              )}

              <div>
                <button
                  onClick={() => openWebsite(searchQuery ? `/skills?q=${encodeURIComponent(searchQuery)}` : '/skills')}
                  className="btn btn-secondary"
                >
                  <ExternalLink size={18} />
                  {searchQuery ? t('discover.viewAllResults') : t('discover.browseAll')}
                </button>
              </div>

              <p className="text-sm text-muted-foreground uppercase tracking-wider">
                {t('discover.showingCount', { count: displayedSkills.length })}
                {!searchQuery && discoverTotalPages > 1 && ` (${t('discover.pageInfo', { page: discoverPage, total: discoverTotalPages })})`}
              </p>
            </div>
          </>
        )
      )}

      {/* Install Modal */}
      {showInstallModal && selectedSkill && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowInstallModal(false)}
        >
          <div 
            className="bg-background border-2 border-foreground w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b-2 border-border-light">
              <div>
                <h2 className="text-xl font-bold tracking-tight">{t('discover.installTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedSkill.name}
                </p>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <ToolSelector showInstallTarget />
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-4 border-t-2 border-border-light">
              <button
                onClick={() => setShowInstallModal(false)}
                className="btn btn-secondary flex-1"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleInstall}
                disabled={installing || selectedToolIds.length === 0}
                className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installing ? t('discover.installing') : t('discover.install')}
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

      {/* KOL Detail Modal */}
      {viewingKol && (
        <KolDetail
          kol={viewingKol}
          onClose={() => setViewingKol(null)}
          onInstallSkill={(skill) => {
            setViewingKol(null)
            handleInstallClick(skill)
          }}
          onViewSkill={(skill) => {
            setViewingKol(null)
            setViewingSkill(skill)
          }}
        />
      )}

      {/* Batch Action Bar */}
      {selectionMode && selectedSkillIds.length > 0 && (
        <BatchActionBar
          skills={displayedSkills}
          onClose={() => {
            clearSkillSelection()
            setSelectionMode(false)
          }}
        />
      )}
    </div>
  )
}
