import { useEffect, useState } from 'react'
import { Heart, ExternalLink, Download, Loader2, Link2, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useAppStore } from '../store'
import { fetchFavorites as apiFetchFavorites, SKILLHUB_URL } from '../api/auth'
import { smartInstallSkill } from '../api/skillhub'
import SkillDetail from '../components/SkillDetail'
import type { FavoriteSkill, SkillHubSkill } from '../types'


export default function Favorites() {
  const { t } = useTranslation()
  const { isAuthenticated, favorites, setFavorites, tools, showToast, logout } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [viewingSkill, setViewingSkill] = useState<SkillHubSkill | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites()
    }
  }, [isAuthenticated])

  const loadFavorites = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetchFavorites()
      setFavorites(data)
    } catch (error) {
      console.error('Failed to fetch favorites:', error)
      if ((error as Error).message === 'Not authenticated' || (error as Error).message === 'Authentication failed') {
        showToast(t('favorites.sessionExpired'), 'warning')
        logout()
      } else {
        showToast(t('favorites.failedToLoad'), 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Extract clean skill name from slug
  const getSkillFolderName = (slug: string, skillName: string): string => {
    const safeName = skillName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    return safeName || slug.split('-').slice(-1)[0] || 'skill'
  }

  const handleInstall = async (favorite: FavoriteSkill) => {
    const installedTools = tools.filter(t => t.installed)
    if (installedTools.length === 0) {
      showToast(t('favorites.noToolsDetected'), 'warning')
      return
    }

    setInstallingId(favorite.skill_id)
    try {
      const toolIds = installedTools.map(t => t.id)
      await smartInstallSkill(favorite.skill, toolIds)
      showToast(t('favorites.installed', { name: favorite.skill.name, count: installedTools.length }), 'success')
    } catch (error) {
      console.error('Install failed:', error)
      if ((error as Error).message === 'No skill content available') {
        showToast(t('favorites.noSkillContent'), 'warning')
      } else {
        showToast(t('favorites.installFailed'), 'error')
      }
    } finally {
      setInstallingId(null)
    }
  }

  const handleCopyLink = async (skill: SkillHubSkill) => {
    const url = `${SKILLHUB_URL}/skills/${skill.slug}`
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('favorites.linkCopied'), 'success')
    } catch (error) {
      console.error('Failed to copy:', error)
      showToast(t('favorites.copyFailed'), 'error')
    }
  }

  const handleExport = async (skill: SkillHubSkill) => {
    try {
      const content = skill.skill_md_raw || `---
name: "${skill.name}"
description: "${skill.description}"
author: "${skill.author}"
---

# ${skill.name}

${skill.description}
`
      const skillFolderName = getSkillFolderName(skill.slug, skill.name)
      const filePath = await save({
        defaultPath: `${skillFolderName}-SKILL.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (filePath) {
        await writeTextFile(filePath, content)
        showToast(t('favorites.exported', { name: skill.name }), 'success')
      }
    } catch (error) {
      console.error('Export failed:', error)
      showToast(t('favorites.exportFailed'), 'error')
    }
  }

  const openInBrowser = (url: string) => {
    window.open(url, '_blank')
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('favorites.signInTitle')}</h2>
          <p className="text-muted-foreground">
            {t('favorites.signInDesc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">{t('favorites.title').toUpperCase()}</h1>
          <p className="text-muted-foreground">{t('favorites.subtitle')}</p>
        </div>
        <button
          onClick={loadFavorites}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          {isLoading ? t('favorites.syncing') : t('favorites.sync')}
        </button>
      </div>

      {isLoading && favorites.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-foreground" size={32} />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('favorites.noFavorites')}</h2>
          <p className="text-muted-foreground">
            {t('favorites.visitSkillHub')}{' '}
            <button
              onClick={() => openInBrowser(`${SKILLHUB_URL}/skills`)}
              className="text-foreground underline underline-offset-4 hover:decoration-2"
            >
              SkillHub
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="card p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
              onClick={() => setViewingSkill(favorite.skill)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">
                    {favorite.skill.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    by {favorite.skill.author}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {favorite.skill.description}
                  </p>
                  {favorite.skill.tags && favorite.skill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {favorite.skill.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-secondary text-foreground text-xs font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Copy Link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyLink(favorite.skill)
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title={t('favorites.copyLink')}
                  >
                    <Link2 size={18} />
                  </button>
                  {/* Export */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(favorite.skill)
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title={t('favorites.export')}
                  >
                    <FileDown size={18} />
                  </button>
                  {/* View on SkillHub */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openInBrowser(`${SKILLHUB_URL}/skills/${favorite.skill.slug}`)
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title={t('favorites.viewOnSkillHub')}
                  >
                    <ExternalLink size={18} />
                  </button>
                  {/* Install */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleInstall(favorite)
                    }}
                    disabled={installingId === favorite.skill_id}
                    className="flex items-center gap-2 px-3 py-2 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors ml-1"
                  >
                    {installingId === favorite.skill_id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {t('favorites.install')}
                  </button>
                </div>
              </div>
            </div>
          ))}
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
