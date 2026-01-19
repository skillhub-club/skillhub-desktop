import { useEffect, useState } from 'react'
import { Folder, ExternalLink, Download, Loader2, ChevronDown, ChevronRight, Link2, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useAppStore } from '../store'
import { fetchCollections as apiFetchCollections, SKILLHUB_URL } from '../api/auth'
import { smartInstallSkill } from '../api/skillhub'
import type { SkillCollection, SkillHubSkill } from '../types'

export default function Collections() {
  const { t } = useTranslation()
  const { isAuthenticated, collections, setCollections, tools, showToast, logout } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isAuthenticated) {
      loadCollections()
    }
  }, [isAuthenticated])

  const loadCollections = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetchCollections()
      setCollections(data)
    } catch (error) {
      console.error('Failed to fetch collections:', error)
      if ((error as Error).message === 'Not authenticated' || (error as Error).message === 'Authentication failed') {
        showToast(t('collections.sessionExpired'), 'warning')
        logout()
      } else {
        showToast(t('collections.failedToLoad'), 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
  }

  const handleInstallSkill = async (skill: SkillHubSkill) => {
    const installedTools = tools.filter(t => t.installed)
    if (installedTools.length === 0) {
      showToast(t('collections.noToolsDetected'), 'warning')
      return
    }

    setInstallingId(skill.id)
    try {
      const toolIds = installedTools.map(t => t.id)
      await smartInstallSkill(skill, toolIds)
      showToast(t('collections.installed', { name: skill.name, count: installedTools.length }), 'success')
    } catch (error) {
      console.error('Install failed:', error)
      if ((error as Error).message === 'No skill content available') {
        showToast(t('collections.noSkillContent'), 'warning')
      } else {
        showToast(t('collections.installFailed'), 'error')
      }
    } finally {
      setInstallingId(null)
    }
  }

  const handleInstallCollection = async (collection: SkillCollection) => {
    const installedTools = tools.filter(t => t.installed)
    if (installedTools.length === 0) {
      showToast(t('collections.noToolsDetected'), 'warning')
      return
    }

    if (collection.skills.length === 0) {
      showToast(t('collections.noSkillsInCollection'), 'info')
      return
    }

    setInstallingId(collection.id)
    try {
      const toolIds = installedTools.map(t => t.id)
      let installedCount = 0

      for (const skill of collection.skills) {
        try {
          await smartInstallSkill(skill, toolIds)
          installedCount++
        } catch (err) {
          console.error(`Failed to install skill ${skill.name}:`, err)
        }
      }

      if (installedCount > 0) {
        showToast(t('collections.installedCollection', { count: installedCount, name: collection.name }), 'success')
      } else {
        showToast(t('collections.installFailed'), 'error')
      }
    } catch (error) {
      console.error('Install failed:', error)
      showToast(t('collections.installFailed'), 'error')
    } finally {
      setInstallingId(null)
    }
  }

  const handleCopyLink = async (skill: SkillHubSkill) => {
    const url = `${SKILLHUB_URL}/skills/${skill.slug}`
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('collections.linkCopied'), 'success')
    } catch (error) {
      console.error('Failed to copy:', error)
      showToast(t('collections.copyFailed'), 'error')
    }
  }

  const handleExportSkill = async (skill: SkillHubSkill) => {
    try {
      const content = skill.skill_md_raw || `---
name: "${skill.name}"
description: "${skill.description}"
author: "${skill.author}"
---

# ${skill.name}

${skill.description}
`
      // Create a safe filename from skill name
      const skillFolderName = skill.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() || skill.slug.split('-').slice(-1)[0] || 'skill'
      const filePath = await save({
        defaultPath: `${skillFolderName}-SKILL.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (filePath) {
        await writeTextFile(filePath, content)
        showToast(t('collections.exported', { name: skill.name }), 'success')
      }
    } catch (error) {
      console.error('Export failed:', error)
      showToast(t('collections.exportFailed'), 'error')
    }
  }

  const openInBrowser = (url: string) => {
    window.open(url, '_blank')
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="text-center py-16">
          <Folder size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('collections.signInTitle')}</h2>
          <p className="text-muted-foreground">
            {t('collections.signInDesc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">{t('collections.title').toUpperCase()}</h1>
          <p className="text-muted-foreground">{t('collections.subtitle')}</p>
        </div>
        <button
          onClick={loadCollections}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          {isLoading ? t('collections.syncing') : t('collections.sync')}
        </button>
      </div>

      {isLoading && collections.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-foreground" size={32} />
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16">
          <Folder size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('collections.noCollections')}</h2>
          <p className="text-muted-foreground">
            {t('collections.visitSkillHub')}{' '}
            <button
              onClick={() => openInBrowser(`${SKILLHUB_URL}/app/collections`)}
              className="text-foreground underline underline-offset-4 hover:decoration-2"
            >
              SkillHub
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="card overflow-hidden"
            >
              {/* Collection Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleCollection(collection.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expandedCollections.has(collection.id) ? (
                    <ChevronDown size={20} className="text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="text-muted-foreground shrink-0" />
                  )}
                  <Folder size={20} className="text-foreground shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground truncate">
                      {collection.name}
                    </h3>
                    {collection.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {collection.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {collection.skills.length} {t('collections.skills')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleInstallCollection(collection)
                  }}
                  disabled={installingId === collection.id || collection.skills.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors ml-4"
                >
                  {installingId === collection.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {t('collections.installAll')}
                </button>
              </div>

              {/* Collection Skills */}
              {expandedCollections.has(collection.id) && collection.skills.length > 0 && (
                <div className="border-t-2 border-border-light divide-y divide-border-light">
                  {collection.skills.map((skill) => (
                    <div key={skill.id} className="p-4 pl-12 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground">
                            {skill.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            by {skill.author}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {skill.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Copy Link */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyLink(skill)
                            }}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title={t('collections.copyLink')}
                          >
                            <Link2 size={16} />
                          </button>
                          {/* Export */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExportSkill(skill)
                            }}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title={t('collections.export')}
                          >
                            <FileDown size={16} />
                          </button>
                          {/* View on SkillHub */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openInBrowser(`${SKILLHUB_URL}/skills/${skill.slug}`)
                            }}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title={t('collections.viewOnSkillHub')}
                          >
                            <ExternalLink size={16} />
                          </button>
                          {/* Install */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInstallSkill(skill)
                            }}
                            disabled={installingId === skill.id}
                            className="flex items-center gap-1 px-2 py-1 bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                          >
                            {installingId === skill.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            {t('collections.install')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
