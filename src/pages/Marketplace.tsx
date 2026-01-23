import { useEffect, useMemo, useState } from 'react'
import {
  Store,
  Search,
  Tag,
  Filter,
  ArrowUpDown,
  Image,
  Loader2,
  X,
  Users,
  Clock,
  RefreshCw,
} from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { open } from '@tauri-apps/plugin-shell'
import { useAppStore } from '../store'
import ToolSelector from '../components/ToolSelector'
import SkillCard from '../components/SkillCard'
import {
  detectTools,
  getSkillFilesForVersion,
  installSkill,
  smartInstallSkillToProject,
  listMarketplaceSkills,
} from '../api/skillhub'
import { exchangeCodeForTokens, SKILLHUB_URL } from '../api/auth'
import type { MarketplaceSkill, MarketplaceSortOption, SkillHubSkill } from '../types'

const PAGE_SIZE = 12

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All' },
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

const SORT_OPTIONS: { id: MarketplaceSortOption; label: string }[] = [
  { id: 'published_at_desc', label: 'Newest' },
  { id: 'updated_at_desc', label: 'Recently Updated' },
  { id: 'views_desc', label: 'Most Viewed' },
  { id: 'downloads_desc', label: 'Most Downloaded' },
  { id: 'name_asc', label: 'Name A-Z' },
]

type SkillCardAdapted = SkillHubSkill & {
  skill_path?: string | null
}

function toSkillCardSkill(skill: MarketplaceSkill): SkillCardAdapted {
  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    description_zh: skill.description_zh,
    author: skill.ownerName || 'User',
    category: skill.category,
    tags: skill.tags,
    repo_url: '',
    skill_md_raw: '',
    skill_path: null,
  }
}

export default function Marketplace() {
  const {
    isAuthenticated,
    accessToken,
    showToast,
    theme,
    selectedToolIds,
    installTarget,
    projectPath,
    setTools,
    login: loginUser,
    setFavorites,
    setCollections,
  } = useAppStore()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tag, setTag] = useState('')
  const [debouncedTag, setDebouncedTag] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<MarketplaceSortOption>('published_at_desc')
  const [hasCoverOnly, setHasCoverOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [skills, setSkills] = useState<MarketplaceSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [viewingSkill, setViewingSkill] = useState<MarketplaceSkill | null>(null)
  const [skillContent, setSkillContent] = useState('')
  const [loadingSkillContent, setLoadingSkillContent] = useState(false)
  const [installing, setInstalling] = useState(false)

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginCode, setLoginCode] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Load installed tools for installation flow
  useEffect(() => {
    detectTools().then(setTools).catch(console.error)
  }, [setTools])

  // Debounce text inputs
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTag(tag.trim()), 300)
    return () => clearTimeout(timer)
  }, [tag])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedTag, category, hasCoverOnly, sort])

  // Fetch marketplace skills
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setSkills([])
      setTotal(0)
      return
    }

    setLoading(true)
    setError(null)

    listMarketplaceSkills(accessToken, {
      page,
      pageSize,
      q: debouncedSearch || undefined,
      category: category === 'all' ? undefined : category,
      tag: debouncedTag || undefined,
      hasCover: hasCoverOnly ? true : undefined,
      sort,
    })
      .then((data) => {
        setSkills(data.skills || [])
        setPage(data.page || 1)
        setPageSize(data.page_size || PAGE_SIZE)
        setTotal(data.total || 0)
      })
      .catch((err) => {
        console.error('Failed to load marketplace:', err)
        setSkills([])
        setError(err instanceof Error ? err.message : 'Failed to load marketplace')
        showToast('Failed to load marketplace', 'error')
      })
      .finally(() => setLoading(false))
  }, [
    accessToken,
    category,
    debouncedSearch,
    debouncedTag,
    hasCoverOnly,
    isAuthenticated,
    page,
    pageSize,
    refreshKey,
    showToast,
    sort,
  ])

  const totalPages = useMemo(() => {
    if (!pageSize) return 1
    return Math.max(1, Math.ceil(total / pageSize))
  }, [pageSize, total])

  const handleViewSkill = async (skill: MarketplaceSkill) => {
    if (!accessToken) {
      showToast('Please sign in to view this skill', 'warning')
      return
    }

    setViewingSkill(skill)
    setSkillContent('')
    setLoadingSkillContent(true)

    try {
      const files = await getSkillFilesForVersion(accessToken, skill.id, skill.currentVersion)
      const skillFile = files.find((f) => f.filepath.toLowerCase() === 'skill.md')

      if (skillFile?.content) {
        setSkillContent(skillFile.content)
      } else {
        setSkillContent('')
      }
    } catch (err) {
      console.error('Failed to load skill files:', err)
      showToast('Failed to load skill files', 'error')
    } finally {
      setLoadingSkillContent(false)
    }
  }

  const handleInstall = async () => {
    if (installing) return
    if (!viewingSkill) return
    if (!skillContent) {
      showToast('Skill content not loaded yet', 'warning')
      return
    }
    if (selectedToolIds.length === 0) {
      showToast('Please select at least one tool', 'warning')
      return
    }

    const safeName =
      viewingSkill.slug?.trim() ||
      viewingSkill.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() ||
      'skill'

    setInstalling(true)
    try {
      if (installTarget === 'project' && projectPath) {
        await smartInstallSkillToProject(
          { ...toSkillCardSkill(viewingSkill), skill_md_raw: skillContent },
          projectPath,
          selectedToolIds
        )
        showToast(`Installed "${viewingSkill.name}" to project`, 'success')
      } else {
        await installSkill(skillContent, safeName, selectedToolIds)
        showToast(`Installed "${viewingSkill.name}" to ${selectedToolIds.length} tool(s)`, 'success')
      }

      // Refresh tool state to update counts
      const newTools = await detectTools()
      setTools(newTools)
    } catch (err) {
      console.error('Installation failed:', err)
      showToast('Installation failed', 'error')
    } finally {
      setInstalling(false)
    }
  }

  const startLogin = async () => {
    try {
      await open(`${SKILLHUB_URL}/web/auth/signin?callback=desktop`)
      setShowLoginModal(true)
    } catch (error) {
      console.error('Failed to open browser:', error)
      showToast('Failed to open browser for login', 'error')
    }
  }

  const handleLoginSubmit = async () => {
    if (!loginCode.trim()) return
    setLoggingIn(true)
    try {
      const tokens = await exchangeCodeForTokens(loginCode.trim())
      const expiresAt = Date.now() + tokens.expiresIn * 1000

      const userResponse = await fetch(`${SKILLHUB_URL}/api/v1/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to get user info')
      }

      const userData = await userResponse.json()

      loginUser(userData, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      })

      const [favoritesRes, collectionsRes] = await Promise.all([
        fetch(`${SKILLHUB_URL}/api/v1/oauth/favorites`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
        fetch(`${SKILLHUB_URL}/api/v1/oauth/collections`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
      ])

      if (favoritesRes.ok) {
        const favData = await favoritesRes.json()
        setFavorites(favData.favorites || [])
      }

      if (collectionsRes.ok) {
        const collData = await collectionsRes.json()
        setCollections(collData.collections || [])
      }

      setShowLoginModal(false)
      setLoginCode('')
      showToast(`Welcome, ${userData.name || userData.github_username || 'SkillHub user'}!`, 'success')
    } catch (error) {
      console.error('Login failed:', error)
      showToast('Login failed. Please try again.', 'error')
    } finally {
      setLoggingIn(false)
    }
  }

  const renderLoginGate = () => (
    <div className="p-8 flex flex-col items-center justify-center min-h-[calc(100vh-6rem)]">
      <div className="max-w-xl text-center space-y-5">
        <div className="inline-flex items-center gap-3 px-4 py-2 border-2 border-foreground bg-secondary uppercase tracking-wider text-sm font-semibold">
          <Store size={18} />
          Marketplace
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Sign in to explore user-hosted skills</h1>
        <p className="text-muted-foreground leading-relaxed">
          Access the new marketplace of community and private skills. Filter, preview, and install directly to your tools once authenticated.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={startLogin}
            className="btn btn-primary"
          >
            Start sign-in
          </button>
          <button
            onClick={() => setShowLoginModal(true)}
            className="btn btn-secondary"
          >
            I already have a code
          </button>
        </div>
      </div>
    </div>
  )

  if (!isAuthenticated || !accessToken) {
    return (
      <>
        {renderLoginGate()}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border-2 border-foreground p-6 w-full max-w-sm mx-4">
              <h2 className="text-xl font-bold mb-2 tracking-tight">Enter login code</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Paste the 8-digit code from the browser window.
              </p>
              <input
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="input text-center text-2xl font-mono tracking-widest mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowLoginModal(false)
                    setLoginCode('')
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLoginSubmit}
                  disabled={loggingIn || !loginCode.trim()}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {loggingIn ? 'Signing in...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  const startItemIndex = (page - 1) * pageSize + 1
  const endItemIndex = Math.min(total, page * pageSize)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-foreground bg-secondary uppercase tracking-wider text-xs font-bold">
            <Store size={16} />
            Marketplace
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mt-2">User-hosted skills</h1>
          <p className="text-sm text-muted-foreground">
            Browse public skills uploaded by the community, filtered and ready for installation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xl font-bold text-foreground leading-tight">{total.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Skills available</p>
          </div>
          <button
            onClick={() => setRefreshKey((n) => n + 1)}
            className="btn btn-secondary"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 lg:grid-cols-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search marketplace..."
            className="input pl-10"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Filter by tag"
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setHasCoverOnly((v) => !v)}
            className={`px-3 border-2 flex items-center gap-2 uppercase tracking-wider text-xs font-semibold ${
              hasCoverOnly ? 'bg-foreground text-background border-foreground' : 'border-border-light hover:border-foreground'
            }`}
          >
            <Image size={14} />
            Cover
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <Filter size={12} />
              Category
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <ArrowUpDown size={12} />
            Sort
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as MarketplaceSortOption)}
            className="input"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="border-2 border-border-light bg-secondary p-4 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          Showing {Math.min(endItemIndex - startItemIndex + 1, skills.length)} of {total} (page {page} / {totalPages})
        </span>
        <span className="flex items-center gap-2">
          <Clock size={12} />
          Auto-refresh disabled
        </span>
      </div>

      {error && (
        <div className="border-2 border-red-500 text-red-500 p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-foreground" size={32} />
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-border-light">
          No skills found with current filters.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={toSkillCardSkill(skill)}
              onView={() => handleViewSkill(skill)}
              onInstall={() => handleViewSkill(skill)}
              installing={installing && viewingSkill?.id === skill.id}
              showPreviewButton
              customUrl={`/web/skills/${skill.slug.replace(/\//g, '-')}`}
              meta={{
                coverUrl: skill.coverUrl,
                views: skill.views,
                downloads: skill.downloads,
                ownerName: skill.ownerName,
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {skills.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-primary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail / Install modal */}
      {viewingSkill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setViewingSkill(null)}>
          <div
            className="bg-background border-2 border-foreground w-full max-w-5xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-border-light">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketplace skill</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{viewingSkill.name}</h2>
              </div>
              <button
                onClick={() => setViewingSkill(null)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-5 overflow-y-auto max-h-[80vh]">
              <div className="space-y-4 md:col-span-2">
                <div className="border-2 border-border-light p-3 bg-secondary">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Owner</p>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users size={14} />
                    {viewingSkill.ownerName || 'Unknown'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated {viewingSkill.updated_at ? new Date(viewingSkill.updated_at).toLocaleDateString() : viewingSkill.updatedAt ? new Date(viewingSkill.updatedAt).toLocaleDateString() : '—'}
                  </p>
                </div>

                <div className="border-2 border-border-light p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Install to</p>
                  <ToolSelector showInstallTarget />
                  <button
                    onClick={handleInstall}
                    disabled={loadingSkillContent || installing || !skillContent}
                    className="btn btn-primary w-full disabled:opacity-50"
                  >
                    {installing ? 'Installing...' : 'Install skill'}
                  </button>
                  {(!skillContent || loadingSkillContent) && (
                    <p className="text-xs text-muted-foreground">
                      {loadingSkillContent ? 'Loading SKILL.md...' : 'Preview SKILL.md first to enable install.'}
                    </p>
                  )}
                </div>

                <div className="border border-border-light p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
                  {viewingSkill.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {viewingSkill.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 text-[11px] uppercase tracking-wider bg-secondary border border-border-light">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No tags</p>
                  )}
                </div>
              </div>

              <div className="md:col-span-3 border-2 border-border-light p-4 overflow-y-auto" data-color-mode={theme}>
                {loadingSkillContent ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin text-foreground" size={28} />
                  </div>
                ) : skillContent ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <MDEditor.Markdown source={skillContent} />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-10">
                    No SKILL.md available to preview.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
