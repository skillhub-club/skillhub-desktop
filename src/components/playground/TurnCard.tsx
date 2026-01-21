/**
 * TurnCard - Craft Agents style turn display for playground
 * 
 * Shows a collapsible card with:
 * - Header with expand/collapse, status icon, preview text, activity count
 * - Expandable activity list with tool calls, results
 * - Optional response card at the bottom
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  Circle,
  Wrench,
  MessageSquare,
  Terminal,
  FileText,
  Copy,
  Check,
} from 'lucide-react'
import { Spinner } from './Spinner'

// ============================================================================
// Types
// ============================================================================

export type ActivityStatus = 'pending' | 'running' | 'completed' | 'error'
export type ActivityType = 'tool_call' | 'tool_result' | 'thinking' | 'response'

export interface Activity {
  id: string
  type: ActivityType
  status: ActivityStatus
  title: string
  content: string
  details?: string
  timestamp: Date
}

export interface TurnCardProps {
  /** All activities in this turn */
  activities: Activity[]
  /** Whether the turn is still processing */
  isProcessing?: boolean
  /** Optional response text to show at the bottom */
  response?: string
  /** Start expanded */
  defaultExpanded?: boolean
}

// ============================================================================
// Size Configuration
// ============================================================================

const SIZE_CONFIG = {
  fontSize: 'text-[13px]',
  iconSize: 'w-3 h-3',
  spinnerSize: 'text-[10px]',
} as const

// ============================================================================
// Helper Components
// ============================================================================

function ActivityStatusIcon({ status }: { status: ActivityStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className={`${SIZE_CONFIG.iconSize} shrink-0 text-muted-foreground/50`} />
    case 'running':
      return <Spinner className={`${SIZE_CONFIG.spinnerSize} shrink-0 text-muted-foreground`} />
    case 'completed':
      return <CheckCircle2 className={`${SIZE_CONFIG.iconSize} shrink-0 text-[var(--success)]`} />
    case 'error':
      return <XCircle className={`${SIZE_CONFIG.iconSize} shrink-0 text-[var(--destructive)]`} />
  }
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const className = `${SIZE_CONFIG.iconSize} shrink-0 text-muted-foreground`
  switch (type) {
    case 'tool_call':
      return <Wrench className={className} />
    case 'tool_result':
      return <Terminal className={className} />
    case 'thinking':
      return <FileText className={className} />
    case 'response':
      return <MessageSquare className={className} />
  }
}

interface ActivityRowProps {
  activity: Activity
  isLast?: boolean
}

function ActivityRow({ activity, isLast }: ActivityRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`${isLast ? '' : 'border-b border-border/30'}`}>
      <div
        className={`group/row flex items-center gap-2 px-3 py-1.5 cursor-pointer
                    hover:bg-secondary/50 transition-colors ${SIZE_CONFIG.fontSize}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand indicator */}
        <ChevronRight
          className={`${SIZE_CONFIG.iconSize} shrink-0 text-muted-foreground/50 transition-transform
                      ${expanded ? 'rotate-90' : ''}`}
        />

        {/* Status icon */}
        <ActivityStatusIcon status={activity.status} />

        {/* Activity icon */}
        <ActivityIcon type={activity.type} />

        {/* Title */}
        <span className="font-medium text-foreground">{activity.title}</span>

        {/* Preview content */}
        {!expanded && activity.content && (
          <span className="text-muted-foreground truncate flex-1">
            {activity.content.substring(0, 60)}{activity.content.length > 60 ? '...' : ''}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Time */}
        <span className="text-muted-foreground/60 text-[11px] tabular-nums shrink-0">
          {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 ml-[52px] border-l-2 border-border/30">
          <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">
            {activity.content}
          </p>
          {activity.details && (
            <pre className="text-muted-foreground text-xs mt-2 pt-2 border-t border-border/30 overflow-x-auto">
              {activity.details}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

interface ResponseCardProps {
  text: string
}

function ResponseCard({ text }: ResponseCardProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="bg-background shadow-minimal rounded-[8px] overflow-hidden mt-2">
      {/* Content */}
      <div
        className="px-4 py-3 text-sm overflow-y-auto"
        style={{ maxHeight: 400 }}
      >
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
          {text}
        </p>
      </div>

      {/* Footer */}
      <div className={`px-4 py-2 border-t border-border/30 flex items-center bg-secondary/20 ${SIZE_CONFIG.fontSize}`}>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 transition-colors
                      ${copied ? 'text-[var(--success)]' : 'text-muted-foreground hover:text-foreground'}
                      focus:outline-none`}
        >
          {copied ? (
            <>
              <Check className={SIZE_CONFIG.iconSize} />
              <span>{t('turnCard.copied')}</span>
            </>
          ) : (
            <>
              <Copy className={SIZE_CONFIG.iconSize} />
              <span>{t('turnCard.copy')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function TurnCard({
  activities,
  isProcessing = false,
  response,
  defaultExpanded = false,
}: TurnCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Calculate stats
  const stats = useMemo(() => {
    const completed = activities.filter(a => a.status === 'completed').length
    const errors = activities.filter(a => a.status === 'error').length
    const running = activities.filter(a => a.status === 'running').length
    return { completed, errors, running, total: activities.length }
  }, [activities])

  // Get preview text for collapsed state
  const previewText = useMemo(() => {
    if (isProcessing) {
      const running = activities.find(a => a.status === 'running')
      if (running) return `${running.title}...`
      return 'Thinking...'
    }
    if (stats.errors > 0) {
      return `${stats.completed} completed, ${stats.errors} error${stats.errors > 1 ? 's' : ''}`
    }
    return `${stats.completed} step${stats.completed !== 1 ? 's' : ''} completed`
  }, [activities, isProcessing, stats])

  return (
    <div className="bg-background shadow-minimal rounded-[8px] overflow-hidden">
      {/* Header - always visible */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer
                    hover:bg-secondary/30 transition-colors ${SIZE_CONFIG.fontSize}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/collapse chevron */}
        <ChevronRight
          className={`${SIZE_CONFIG.iconSize} shrink-0 text-muted-foreground transition-transform
                      ${isExpanded ? 'rotate-90' : ''}`}
        />

        {/* Status indicator */}
        {isProcessing ? (
          <Spinner className={`${SIZE_CONFIG.spinnerSize} shrink-0 text-muted-foreground`} />
        ) : stats.errors > 0 ? (
          <XCircle className={`${SIZE_CONFIG.iconSize} shrink-0 text-[var(--destructive)]`} />
        ) : (
          <CheckCircle2 className={`${SIZE_CONFIG.iconSize} shrink-0 text-[var(--success)]`} />
        )}

        {/* Preview text */}
        <span className={`text-muted-foreground ${stats.errors > 0 ? 'text-[var(--destructive)]' : ''}`}>
          {previewText}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Activity count badge */}
        <span className="shrink-0 px-1.5 py-0.5 rounded-[4px] bg-secondary text-[10px] font-medium text-muted-foreground">
          {stats.total} {stats.total === 1 ? 'step' : 'steps'}
        </span>
      </div>

      {/* Activities list - shown when expanded */}
      {isExpanded && activities.length > 0 && (
        <div className="border-t border-border/30">
          {activities.map((activity, idx) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              isLast={idx === activities.length - 1}
            />
          ))}
        </div>
      )}

      {/* Response card - shown when expanded and response exists */}
      {isExpanded && response && (
        <div className="px-3 pb-3">
          <ResponseCard text={response} />
        </div>
      )}
    </div>
  )
}
