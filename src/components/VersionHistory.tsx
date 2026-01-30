import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, GitCommit, ArrowLeftRight, RotateCcw, Download, Clock } from 'lucide-react'
import { getSkillHistory, pullSkill } from '../api/sync'
import type { HistoryResponse, VersionEntry } from '../types'
import DiffViewer from './DiffViewer'

interface VersionHistoryProps {
  skillId: string
  skillName: string
  currentVersion: number
  onClose: () => void
  onRollback?: (version: number) => void
}

function SourceBadge({ source }: { source: string }) {
  const colorMap: Record<string, string> = {
    cli: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    web: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    api: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    desktop: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  }
  return (
    <span className={`px-1.5 py-0.5 text-xs font-medium ${colorMap[source] || 'bg-gray-100 text-gray-600'}`}>
      {source}
    </span>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function VersionHistory({
  skillId,
  skillName,
  currentVersion,
  onClose,
  onRollback,
}: VersionHistoryProps) {
  const { t } = useTranslation()
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState<{ from: number; to: number } | null>(null)
  const [pullingVersion, setPullingVersion] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    getSkillHistory(skillId, { limit: 50 })
      .then(setHistory)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [skillId])

  const handleViewVersion = async (version: number) => {
    setPullingVersion(version)
    try {
      await pullSkill(skillId, version)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load version')
    } finally {
      setPullingVersion(null)
    }
  }

  const handleCompare = (version: VersionEntry) => {
    // Compare selected version with the previous one
    const prevVersion = version.version > 1 ? version.version - 1 : 1
    setShowDiff({ from: prevVersion, to: version.version })
  }

  if (showDiff && history) {
    return (
      <DiffViewer
        skillId={skillId}
        versions={history.versions}
        initialFrom={showDiff.from}
        initialTo={showDiff.to}
        onClose={() => setShowDiff(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border-2 border-foreground w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-foreground">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">{t('mySkills.history.title')}</h2>
            <p className="text-sm text-muted-foreground">{skillName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Total versions */}
        {history && (
          <div className="px-4 py-2 bg-secondary text-sm text-muted-foreground border-b border-border-light">
            {t('mySkills.history.totalVersions', { count: history.total_versions })}
            {' · '}
            {t('mySkills.history.currentVersion', { version: currentVersion })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t('common.loading')}
            </div>
          )}

          {error && (
            <div className="p-4 text-red-600">{error}</div>
          )}

          {history && history.versions.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t('mySkills.history.noVersions')}
            </div>
          )}

          {history && history.versions.map((version, index) => (
            <div
              key={version.id}
              className={`border-b border-border-light px-4 py-3 hover:bg-secondary/50 ${
                version.version === currentVersion ? 'bg-secondary/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center mt-1">
                  <div className={`w-3 h-3 rounded-full border-2 ${
                    version.version === currentVersion
                      ? 'bg-foreground border-foreground'
                      : 'bg-background border-muted-foreground'
                  }`} />
                  {index < history.versions.length - 1 && (
                    <div className="w-0.5 h-full min-h-[24px] bg-border-light mt-1" />
                  )}
                </div>

                {/* Version info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">v{version.version}</span>
                    {version.version === currentVersion && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-foreground text-background">
                        {t('mySkills.history.current')}
                      </span>
                    )}
                    <SourceBadge source={version.source} />
                  </div>

                  {version.change_summary && (
                    <p className="text-sm mt-1">{version.change_summary}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(version.created_at)}
                    </span>
                    <span>{version.file_count} {t('mySkills.history.files')}</span>
                    <span>{formatSize(version.total_size)}</span>
                    {version.git_commit_oid && (
                      <span className="flex items-center gap-1 font-mono">
                        <GitCommit size={12} />
                        {version.git_commit_oid.slice(0, 7)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCompare(version)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    title={t('mySkills.history.compare')}
                  >
                    <ArrowLeftRight size={14} />
                  </button>
                  <button
                    onClick={() => handleViewVersion(version.version)}
                    disabled={pullingVersion === version.version}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
                    title={t('mySkills.history.viewFiles')}
                  >
                    <Download size={14} />
                  </button>
                  {version.version !== currentVersion && onRollback && (
                    <button
                      onClick={() => onRollback(version.version)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      title={t('mySkills.history.rollback')}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
