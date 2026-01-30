import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { open } from '@tauri-apps/plugin-shell'
import {
  Cloud,
  Download,
  Upload,
  ArrowLeftRight,
  History,
  FolderOpen,
  Eye,
  EyeOff,
  FileArchive,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useAppStore } from '../store'
import { listUserSkills } from '../api/skillhub'
import {
  pullSkill,
  pushSkill,
  getRemoteStatus,
  getSkillVersions,
  exportSkillGit,
  compareLocalRemote,
} from '../api/sync'
import type { UserSkill, SyncFile, SyncMeta, VersionEntry, CompareResult } from '../types'
import SyncStatusBadge, { type SyncStatus } from '../components/SyncStatusBadge'
import VersionHistory from '../components/VersionHistory'
import DiffViewer from '../components/DiffViewer'

const SKILLHUB_URL = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'

interface SkillSyncState {
  syncStatus: SyncStatus
  localPath?: string
  syncMeta?: SyncMeta
  compareResult?: CompareResult
}

export default function MySkills() {
  const { t } = useTranslation()
  const { isAuthenticated, accessToken, tools, showToast } = useAppStore()

  const [skills, setSkills] = useState<UserSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStates, setSyncStates] = useState<Record<string, SkillSyncState>>({})
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({})

  // Version history modal
  const [historySkill, setHistorySkill] = useState<UserSkill | null>(null)

  // Diff viewer modal
  const [diffState, setDiffState] = useState<{
    skillId: string
    versions: VersionEntry[]
    from?: number
    to?: number
  } | null>(null)

  // Load user skills
  const loadSkills = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return
    setLoading(true)
    try {
      const data = await listUserSkills(accessToken)
      console.log('[MySkills] listUserSkills raw response:', data)
      // API may return { skills: [...] } or [...] directly
      const skillsList = Array.isArray(data) ? data : (data as unknown as { skills: UserSkill[] }).skills ?? []
      console.log('[MySkills] parsed skills:', skillsList.length)
      setSkills(skillsList)
    } catch (e) {
      console.error('[MySkills] Failed to load skills:', e)
      showToast(e instanceof Error ? e.message : 'Failed to load skills', 'error')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, accessToken, showToast])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // Check local sync state for a skill
  const checkSyncState = useCallback(async (skill: UserSkill) => {
    // Look for this skill in installed tool directories
    for (const tool of tools) {
      if (!tool.skills_path) continue
      const skillPath = `${tool.skills_path}/${skill.slug}`
      try {
        const exists: boolean = await invoke('check_path_exists', { path: skillPath })
        if (exists) {
          const meta: SyncMeta | null = await invoke('read_sync_meta', { path: skillPath })
          if (meta && meta.skill_id === skill.id) {
            // Found a local copy - compare with remote
            try {
              const localFiles: SyncFile[] = await invoke('collect_skill_files_for_sync', { path: skillPath })
              const remoteStatus = await getRemoteStatus(skill.id)
              const compareResult = compareLocalRemote(localFiles, remoteStatus)

              let syncStatus: SyncStatus = 'in_sync'
              if (compareResult.has_changes) {
                // Check if remote is also different (simple heuristic)
                if (meta.version < remoteStatus.current_version) {
                  syncStatus = 'conflict'
                } else {
                  syncStatus = 'local_changes'
                }
              } else if (meta.version < remoteStatus.current_version) {
                syncStatus = 'remote_changes'
              }

              setSyncStates(prev => ({
                ...prev,
                [skill.id]: { syncStatus, localPath: skillPath, syncMeta: meta, compareResult },
              }))
              return
            } catch {
              // Remote check failed, just mark as synced
              setSyncStates(prev => ({
                ...prev,
                [skill.id]: { syncStatus: 'in_sync', localPath: skillPath, syncMeta: meta },
              }))
              return
            }
          }
        }
      } catch {
        // Path doesn't exist or other error
      }
    }
    // Not found locally
    setSyncStates(prev => ({
      ...prev,
      [skill.id]: { syncStatus: 'not_synced' },
    }))
  }, [tools])

  // Check sync states for all skills
  useEffect(() => {
    if (skills.length > 0 && tools.length > 0) {
      skills.forEach(skill => checkSyncState(skill))
    }
  }, [skills, tools, checkSyncState])

  // Set a loading state for a specific skill+action
  const setActionBusy = (skillId: string, action: string | null) => {
    setActionLoading(prev => {
      if (action === null) {
        const next = { ...prev }
        delete next[skillId]
        return next
      }
      return { ...prev, [skillId]: action }
    })
  }

  // Pull a skill to local directory
  const handlePull = async (skill: UserSkill) => {
    setActionBusy(skill.id, 'pull')
    try {
      const data = await pullSkill(skill.id)

      // Determine save path - use first detected tool's skills path
      const targetTool = tools.find(t => t.skills_path)
      if (!targetTool) {
        showToast(t('mySkills.noToolsForPull'), 'error')
        return
      }

      const skillPath = `${targetTool.skills_path}/${skill.slug}`

      // Write files
      await invoke('write_synced_files', { path: skillPath, files: data.files })

      // Write sync metadata
      const meta: SyncMeta = {
        skill_id: skill.id,
        skill_slug: skill.slug,
        version: data.version ?? skill.currentVersion,
        synced_at: new Date().toISOString(),
        platform_url: `${SKILLHUB_URL}/skills/${skill.slug}`,
      }
      await invoke('write_sync_meta', { path: skillPath, meta })

      showToast(t('mySkills.pullSuccess', { name: skill.name }), 'success')

      // Refresh sync state
      checkSyncState(skill)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pull failed'
      showToast(msg, 'error')
    } finally {
      setActionBusy(skill.id, null)
    }
  }

  // Push local changes to server
  const handlePush = async (skill: UserSkill) => {
    const state = syncStates[skill.id]
    if (!state?.localPath) return

    setActionBusy(skill.id, 'push')
    try {
      const localFiles: SyncFile[] = await invoke('collect_skill_files_for_sync', {
        path: state.localPath,
      })

      await pushSkill({
        skill_id: skill.id,
        files: localFiles,
        change_summary: 'Desktop sync',
        source: 'desktop',
      })

      // Update metadata
      const meta: SyncMeta = {
        skill_id: skill.id,
        skill_slug: skill.slug,
        version: skill.currentVersion + 1,
        synced_at: new Date().toISOString(),
        platform_url: `${SKILLHUB_URL}/skills/${skill.slug}`,
      }
      await invoke('write_sync_meta', { path: state.localPath, meta })

      showToast(t('mySkills.pushSuccess', { name: skill.name }), 'success')

      // Refresh
      loadSkills()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Push failed'
      showToast(msg, 'error')
    } finally {
      setActionBusy(skill.id, null)
    }
  }

  // Compare local vs remote
  const handleCompare = async (skill: UserSkill) => {
    setActionBusy(skill.id, 'compare')
    try {
      const versionsData = await getSkillVersions(skill.id)
      setDiffState({
        skillId: skill.id,
        versions: versionsData.versions,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Compare failed'
      showToast(msg, 'error')
    } finally {
      setActionBusy(skill.id, null)
    }
  }

  // View version history
  const handleViewHistory = (skill: UserSkill) => {
    setHistorySkill(skill)
  }

  // Export as Git ZIP
  const handleExportGit = async (skill: UserSkill) => {
    setActionBusy(skill.id, 'export')
    try {
      const blob = await exportSkillGit(skill.id)
      const data = new Uint8Array(await blob.arrayBuffer())

      const savePath = await save({
        defaultPath: `${skill.slug}.zip`,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      })

      if (savePath) {
        await invoke('save_export_file', { data: Array.from(data), savePath })
        showToast(t('mySkills.exportSuccess', { name: skill.name }), 'success')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Export failed'
      showToast(msg, 'error')
    } finally {
      setActionBusy(skill.id, null)
    }
  }

  // Open local folder
  const handleOpenFolder = (skillId: string) => {
    const state = syncStates[skillId]
    if (state?.localPath) {
      invoke('open_folder', { path: state.localPath })
    }
  }

  // Rollback to a specific version
  const handleRollback = async (version: number) => {
    if (!historySkill) return

    const state = syncStates[historySkill.id]
    if (!state?.localPath) {
      showToast(t('mySkills.notSyncedLocally'), 'error')
      return
    }

    try {
      const data = await pullSkill(historySkill.id, version)
      await invoke('write_synced_files', { path: state.localPath, files: data.files })

      const meta: SyncMeta = {
        skill_id: historySkill.id,
        skill_slug: historySkill.slug,
        version,
        synced_at: new Date().toISOString(),
        platform_url: `${SKILLHUB_URL}/skills/${historySkill.slug}`,
      }
      await invoke('write_sync_meta', { path: state.localPath, meta })

      showToast(t('mySkills.rollbackSuccess', { version }), 'success')
      checkSyncState(historySkill)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Rollback failed'
      showToast(msg, 'error')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Cloud size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">{t('mySkills.signInTitle')}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {t('mySkills.signInDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">{t('mySkills.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('mySkills.subtitle')}</p>
        </div>
        <button
          onClick={loadSkills}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border-2 border-foreground text-sm font-semibold uppercase hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Loading */}
      {loading && skills.length === 0 && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          {t('common.loading')}
        </div>
      )}

      {/* Empty state */}
      {!loading && skills.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Cloud size={48} className="text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold mb-2">{t('mySkills.noSkills')}</h3>
          <p className="text-muted-foreground max-w-md mb-4">{t('mySkills.noSkillsDesc')}</p>
          <button
            onClick={() => open(`${SKILLHUB_URL}/app/skills`)}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase"
          >
            <ExternalLink size={16} />
            {t('mySkills.createOnWeb')}
          </button>
        </div>
      )}

      {/* Skill list */}
      <div className="space-y-3">
        {skills.map(skill => {
          const state = syncStates[skill.id]
          const busy = actionLoading[skill.id]

          return (
            <div
              key={skill.id}
              className="border-2 border-foreground p-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Skill info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">{skill.name}</h3>
                    <span className="text-xs text-muted-foreground font-mono">v{skill.currentVersion}</span>
                    {state && <SyncStatusBadge status={state.syncStatus} />}
                    <span className={`px-1.5 py-0.5 text-xs font-medium ${
                      skill.visibility === 'public'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : skill.visibility === 'unlisted'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {skill.visibility === 'public' ? <Eye size={10} className="inline mr-1" /> : <EyeOff size={10} className="inline mr-1" />}
                      {skill.visibility}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">{skill.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{skill.category}</span>
                    <span>{t('mySkills.updated', { date: formatDate(skill.updatedAt) })}</span>
                    {state?.localPath && (
                      <button
                        onClick={() => handleOpenFolder(skill.id)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <FolderOpen size={12} />
                        {t('mySkills.openLocal')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handlePull(skill)}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-foreground text-xs font-semibold uppercase hover:bg-foreground hover:text-background disabled:opacity-50 transition-colors"
                    title={t('mySkills.pull')}
                  >
                    <Download size={14} />
                    {busy === 'pull' ? '...' : t('mySkills.pull')}
                  </button>

                  {state?.localPath && (
                    <button
                      onClick={() => handlePush(skill)}
                      disabled={!!busy || state.syncStatus === 'in_sync'}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border border-foreground text-xs font-semibold uppercase hover:bg-foreground hover:text-background disabled:opacity-50 transition-colors"
                      title={t('mySkills.push')}
                    >
                      <Upload size={14} />
                      {busy === 'push' ? '...' : t('mySkills.push')}
                    </button>
                  )}

                  <button
                    onClick={() => handleCompare(skill)}
                    disabled={!!busy}
                    className="p-1.5 border border-foreground text-xs hover:bg-foreground hover:text-background disabled:opacity-50 transition-colors"
                    title={t('mySkills.compare')}
                  >
                    <ArrowLeftRight size={14} />
                  </button>

                  <button
                    onClick={() => handleViewHistory(skill)}
                    className="p-1.5 border border-foreground text-xs hover:bg-foreground hover:text-background transition-colors"
                    title={t('mySkills.viewHistory')}
                  >
                    <History size={14} />
                  </button>

                  <button
                    onClick={() => handleExportGit(skill)}
                    disabled={!!busy}
                    className="p-1.5 border border-foreground text-xs hover:bg-foreground hover:text-background disabled:opacity-50 transition-colors"
                    title={t('mySkills.exportGit')}
                  >
                    <FileArchive size={14} />
                  </button>
                </div>
              </div>

              {/* Compare result summary */}
              {state?.compareResult?.has_changes && (
                <div className="mt-3 pt-3 border-t border-border-light flex items-center gap-4 text-xs">
                  {state.compareResult.added.length > 0 && (
                    <span className="text-green-700 dark:text-green-400">
                      +{state.compareResult.added.length} {t('mySkills.diff.added')}
                    </span>
                  )}
                  {state.compareResult.modified.length > 0 && (
                    <span className="text-yellow-700 dark:text-yellow-400">
                      ~{state.compareResult.modified.length} {t('mySkills.diff.modified')}
                    </span>
                  )}
                  {state.compareResult.deleted.length > 0 && (
                    <span className="text-red-700 dark:text-red-400">
                      -{state.compareResult.deleted.length} {t('mySkills.diff.deleted')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Version History Modal */}
      {historySkill && (
        <VersionHistory
          skillId={historySkill.id}
          skillName={historySkill.name}
          currentVersion={historySkill.currentVersion}
          onClose={() => setHistorySkill(null)}
          onRollback={handleRollback}
        />
      )}

      {/* Diff Viewer Modal */}
      {diffState && (
        <DiffViewer
          skillId={diffState.skillId}
          versions={diffState.versions}
          initialFrom={diffState.from}
          initialTo={diffState.to}
          onClose={() => setDiffState(null)}
        />
      )}
    </div>
  )
}
