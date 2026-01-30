import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Minus, FileEdit, ChevronDown, ChevronRight } from 'lucide-react'
import { getSkillDiff } from '../api/sync'
import type { DiffResponse, DiffEntry, VersionEntry } from '../types'

interface DiffViewerProps {
  skillId: string
  versions: VersionEntry[]
  initialFrom?: number
  initialTo?: number
  onClose: () => void
}

function computeLineDiff(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; line: string }[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: { type: 'same' | 'added' | 'removed'; line: string }[] = []

  // Simple line-by-line diff using longest common subsequence approach
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  const lines: { type: 'same' | 'added' | 'removed'; line: string }[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      lines.unshift({ type: 'same', line: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      lines.unshift({ type: 'added', line: newLines[j - 1] })
      j--
    } else {
      lines.unshift({ type: 'removed', line: oldLines[i - 1] })
      i--
    }
  }

  return lines.length > 0 ? lines : result
}

function FileStatusBadge({ status }: { status: DiffEntry['status'] }) {
  const { t } = useTranslation()
  const config = {
    added: { label: t('mySkills.diff.added'), className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    modified: { label: t('mySkills.diff.modified'), className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    deleted: { label: t('mySkills.diff.deleted'), className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  }
  const c = config[status]
  return <span className={`px-1.5 py-0.5 text-xs font-medium ${c.className}`}>{c.label}</span>
}

export default function DiffViewer({ skillId, versions, initialFrom, initialTo, onClose }: DiffViewerProps) {
  const { t } = useTranslation()
  const [fromVersion, setFromVersion] = useState(initialFrom ?? (versions.length > 1 ? versions[1].version : 1))
  const [toVersion, setToVersion] = useState(initialTo ?? versions[0]?.version ?? 1)
  const [diffData, setDiffData] = useState<DiffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (fromVersion === toVersion) return

    setLoading(true)
    setError(null)
    getSkillDiff(skillId, fromVersion, toVersion, true)
      .then(setDiffData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [skillId, fromVersion, toVersion])

  const summary = useMemo(() => {
    if (!diffData) return null
    return diffData.summary
  }, [diffData])

  const toggleFile = (filepath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filepath)) next.delete(filepath)
      else next.add(filepath)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border-2 border-foreground w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-foreground">
          <h2 className="text-lg font-bold uppercase tracking-wide">{t('mySkills.diff.title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Version selectors */}
        <div className="flex items-center gap-4 p-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold uppercase">{t('mySkills.diff.from')}</label>
            <select
              value={fromVersion}
              onChange={e => setFromVersion(Number(e.target.value))}
              className="border-2 border-foreground bg-background px-2 py-1 text-sm"
            >
              {versions.map(v => (
                <option key={v.version} value={v.version}>
                  v{v.version} - {v.change_summary || t('mySkills.diff.noSummary')}
                </option>
              ))}
            </select>
          </div>
          <span className="text-muted-foreground font-bold">&rarr;</span>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold uppercase">{t('mySkills.diff.to')}</label>
            <select
              value={toVersion}
              onChange={e => setToVersion(Number(e.target.value))}
              className="border-2 border-foreground bg-background px-2 py-1 text-sm"
            >
              {versions.map(v => (
                <option key={v.version} value={v.version}>
                  v{v.version} - {v.change_summary || t('mySkills.diff.noSummary')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary bar */}
        {summary && (
          <div className="flex items-center gap-4 px-4 py-2 bg-secondary text-sm">
            <span className="text-green-700 dark:text-green-400 flex items-center gap-1">
              <Plus size={14} /> {summary.added} {t('mySkills.diff.added')}
            </span>
            <span className="text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
              <FileEdit size={14} /> {summary.modified} {t('mySkills.diff.modified')}
            </span>
            <span className="text-red-700 dark:text-red-400 flex items-center gap-1">
              <Minus size={14} /> {summary.deleted} {t('mySkills.diff.deleted')}
            </span>
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

          {fromVersion === toVersion && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t('mySkills.diff.sameVersion')}
            </div>
          )}

          {diffData && diffData.changes.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t('mySkills.diff.noChanges')}
            </div>
          )}

          {diffData && diffData.changes.map(entry => (
            <div key={entry.filepath} className="border-b border-border-light">
              {/* File header */}
              <button
                onClick={() => toggleFile(entry.filepath)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary text-left"
              >
                {expandedFiles.has(entry.filepath) ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                <FileStatusBadge status={entry.status} />
                <span className="text-sm font-mono flex-1">{entry.filepath}</span>
              </button>

              {/* Expanded diff content */}
              {expandedFiles.has(entry.filepath) && (entry.oldContent !== undefined || entry.newContent !== undefined) && (
                <div className="px-4 pb-3">
                  <div className="bg-secondary border border-border-light font-mono text-xs overflow-x-auto">
                    {entry.status === 'added' && entry.newContent && (
                      entry.newContent.split('\n').map((line, i) => (
                        <div key={i} className="flex bg-green-50 dark:bg-green-900/20">
                          <span className="w-10 text-right pr-2 text-muted-foreground select-none border-r border-border-light">{i + 1}</span>
                          <span className="pl-2 text-green-800 dark:text-green-300 whitespace-pre">+ {line}</span>
                        </div>
                      ))
                    )}
                    {entry.status === 'deleted' && entry.oldContent && (
                      entry.oldContent.split('\n').map((line, i) => (
                        <div key={i} className="flex bg-red-50 dark:bg-red-900/20">
                          <span className="w-10 text-right pr-2 text-muted-foreground select-none border-r border-border-light">{i + 1}</span>
                          <span className="pl-2 text-red-800 dark:text-red-300 whitespace-pre">- {line}</span>
                        </div>
                      ))
                    )}
                    {entry.status === 'modified' && entry.oldContent && entry.newContent && (
                      computeLineDiff(entry.oldContent, entry.newContent).map((diff, i) => (
                        <div
                          key={i}
                          className={`flex ${
                            diff.type === 'added' ? 'bg-green-50 dark:bg-green-900/20' :
                            diff.type === 'removed' ? 'bg-red-50 dark:bg-red-900/20' : ''
                          }`}
                        >
                          <span className="w-10 text-right pr-2 text-muted-foreground select-none border-r border-border-light">{i + 1}</span>
                          <span className={`pl-2 whitespace-pre ${
                            diff.type === 'added' ? 'text-green-800 dark:text-green-300' :
                            diff.type === 'removed' ? 'text-red-800 dark:text-red-300' : ''
                          }`}>
                            {diff.type === 'added' ? '+ ' : diff.type === 'removed' ? '- ' : '  '}{diff.line}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
