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
import { useTranslation } from 'react-i18next'
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
  { id: 'all', labelKey: 'marketplacePage.categories.all' },
  { id: 'development', labelKey: 'marketplacePage.categories.development' },
  { id: 'devops', labelKey: 'marketplacePage.categories.devops' },
  { id: 'testing', labelKey: 'marketplacePage.categories.testing' },
  { id: 'documentation', labelKey: 'marketplacePage.categories.documentation' },
  { id: 'ai-ml', labelKey: 'marketplacePage.categories.aiMl' },
  { id: 'frontend', labelKey: 'marketplacePage.categories.frontend' },
  { id: 'backend', labelKey: 'marketplacePage.categories.backend' },
  { id: 'security', labelKey: 'marketplacePage.categories.security' },
  { id: 'other', labelKey: 'marketplacePage.categories.other' },
]

const SORT_OPTIONS: { id: MarketplaceSortOption; labelKey: string }[] = [
  { id: 'published_at_desc', labelKey: 'marketplacePage.sort.newest' },
  { id: 'updated_at_desc', labelKey: 'marketplacePage.sort.recentlyUpdated' },
  { id: 'views_desc', labelKey: 'marketplacePage.sort.mostViewed' },
  { id: 'downloads_desc', labelKey: 'marketplacePage.sort.mostDownloaded' },
  { id: 'name_asc', labelKey: 'marketplacePage.sort.nameAz' },
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
  const { t } = useTranslation()
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
        setError(err instanceof Error ? err.message : t('marketplacePage.failedToLoad'))
        showToast(t('marketplacePage.failedToLoad'), 'error')
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
      showToast(t('marketplacePage.signInToView'), 'warning')
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
      showToast(t('marketplacePage.failedToLoadFiles'), 'error')
    } finally {
      setLoadingSkillContent(false)
    }
  }

  const handleInstall = async () => {
    if (installing) return
    if (!viewingSkill) return
    if (!skillContent) {
      showToast(t('marketplacePage.contentNotLoaded'), 'warning')
      return
    }
    if (selectedToolIds.length === 0) {
      showToast(t('marketplacePage.selectToolWarning'), 'warning')
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
        showToast(t('marketplacePage.installedToProject', { name: viewingSkill.name }), 'success')
      } else {
        await installSkill(skillContent, safeName, selectedToolIds)
        showToast(t('marketplacePage.installedToTools', { name: viewingSkill.name, count: selectedToolIds.length }), 'success')
      }

      // Refresh tool state to update counts
      const newTools = await detectTools()
      setTools(newTools)
    } catch (err) {
      console.error('Installation failed:', err)
      showToast(t('marketplacePage.installFailed'), 'error')
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
      showToast(t('marketplacePage.openBrowserFailed'), 'error')
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
        throw new Error(t('marketplacePage.failedToGetUserInfo'))
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
      const displayName = userData.name || userData.github_username || t('marketplacePage.userFallback')
      showToast(t('marketplacePage.welcome', { name: displayName }), 'success')
    } catch (error) {
      console.error('Login failed:', error)
      showToast(t('marketplacePage.loginFailed'), 'error')
    } finally {
      setLoggingIn(false)
    }
  }

  const renderLoginGate = () => (
    <div className="p-8 flex flex-col items-center justify-center min-h-[calc(100vh-6rem)]">
      <div className="max-w-xl text-center space-y-5">
        <div className="inline-flex items-center gap-3 px-4 py-2 border-2 border-foreground bg-secondary uppercase tracking-wider text-sm font-semibold">
          <Store size={18} />
          {t('marketplacePage.title')}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">{t('marketplacePage.signInTitle')}</h1>
        <p className="text-muted-foreground leading-relaxed">
          {t('marketplacePage.signInDesc')}
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={startLogin}
            className="btn btn-primary"
          >
            {t('marketplacePage.startSignIn')}
          </button>
          <button
            onClick={() => setShowLoginModal(true)}
            className="btn btn-secondary"
          >
            {t('marketplacePage.haveCode')}
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
              <h2 className="text-xl font-bold mb-2 tracking-tight">{t('marketplacePage.loginCodeTitle')}</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {t('marketplacePage.loginCodeDesc')}
              </p>
              <input
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                placeholder={t('marketplacePage.loginCodePlaceholder')}
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
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleLoginSubmit}
                  disabled={loggingIn || !loginCode.trim()}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {loggingIn ? t('marketplacePage.signingIn') : t('marketplacePage.submit')}
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
            {t('marketplacePage.title')}
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mt-2">{t('marketplacePage.subtitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('marketplacePage.subtitleDesc')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xl font-bold text-foreground leading-tight">{total.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('marketplacePage.skillsAvailable')}</p>
          </div>
          <button
            onClick={() => setRefreshKey((n) => n + 1)}
            className="btn btn-secondary"
          >
            <RefreshCw size={16} />
            {t('common.refresh')}
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
            placeholder={t('marketplacePage.searchPlaceholder')}
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
              placeholder={t('marketplacePage.tagPlaceholder')}
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
            {t('marketplacePage.coverOnly')}
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <Filter size={12} />
              {t('marketplacePage.category')}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {t(cat.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <ArrowUpDown size={12} />
            {t('marketplacePage.sortLabel')}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as MarketplaceSortOption)}
            className="input"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="border-2 border-border-light bg-secondary p-4 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          {t('marketplacePage.showing', {
            showing: Math.min(endItemIndex - startItemIndex + 1, skills.length),
            total,
            page,
            totalPages,
          })}
        </span>
        <span className="flex items-center gap-2">
          <Clock size={12} />
          {t('marketplacePage.autoRefreshDisabled')}
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
          {t('marketplacePage.noSkills')}
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
            {t('marketplacePage.pageOf', { page, totalPages })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary disabled:opacity-50"
            >
              {t('marketplacePage.prev')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-primary disabled:opacity-50"
            >
              {t('marketplacePage.next')}
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
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('marketplacePage.marketplaceSkill')}</p>
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
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t('marketplacePage.owner')}</p>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users size={14} />
                    {viewingSkill.ownerName || t('marketplacePage.unknown')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('marketplacePage.updated', {
                      date: viewingSkill.updated_at
                        ? new Date(viewingSkill.updated_at).toLocaleDateString()
                        : viewingSkill.updatedAt
                          ? new Date(viewingSkill.updatedAt).toLocaleDateString()
                          : '—',
                    })}
                  </p>
                </div>

                <div className="border-2 border-border-light p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('marketplacePage.installTo')}</p>
                  <ToolSelector showInstallTarget />
                  <button
                    onClick={handleInstall}
                    disabled={loadingSkillContent || installing || !skillContent}
                    className="btn btn-primary w-full disabled:opacity-50"
                  >
                    {installing ? t('marketplacePage.installing') : t('marketplacePage.installSkill')}
                  </button>
                  {(!skillContent || loadingSkillContent) && (
                    <p className="text-xs text-muted-foreground">
                      {loadingSkillContent
                        ? t('marketplacePage.loadingSkillMd')
                        : t('marketplacePage.previewSkillMdFirst')}
                    </p>
                  )}
                </div>

                <div className="border border-border-light p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t('marketplacePage.tags')}</p>
                  {viewingSkill.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {viewingSkill.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 text-[11px] uppercase tracking-wider bg-secondary border border-border-light">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('marketplacePage.noTags')}</p>
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
                    {t('marketplacePage.noSkillMd')}
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
