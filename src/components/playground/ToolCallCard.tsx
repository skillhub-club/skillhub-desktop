/**
 * ToolCallCard - Inline collapsible tool call display (Claude.ai style)
 * 
 * Features:
 * - Compact inline display when collapsed
 * - Expandable details view
 * - Status indicator (running/completed/error)
 * - Tool-specific icons
 */

import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  FileText,
  Edit3,
  Terminal,
  Search,
  FolderSearch,
  Globe,
  HelpCircle,
  Wrench,
  Code,
  GitBranch,
} from 'lucide-react'
import { Spinner } from './Spinner'
import { Button } from '../ui/button'

export type ToolStatus = 'running' | 'completed' | 'error'

export interface ToolCallCardProps {
  /** Tool name */
  toolName: string
  /** Brief description/preview of the tool call */
  preview: string
  /** Full input details (JSON) */
  details?: string
  /** Tool result content */
  result?: string
  /** Current status */
  status: ToolStatus
  /** Timestamp */
  timestamp?: Date
  /** Start expanded */
  defaultExpanded?: boolean
  /** Additional className */
  className?: string
}

// Tool icon mapping
const TOOL_ICONS: Record<string, typeof Wrench> = {
  Read: FileText,
  Write: Edit3,
  Edit: Edit3,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderSearch,
  WebFetch: Globe,
  AskUserQuestion: HelpCircle,
  Task: GitBranch,
  Skill: Code,
}

function getToolIcon(toolName: string) {
  return TOOL_ICONS[toolName] || Wrench
}

// Status icon component
function StatusIcon({ status }: { status: ToolStatus }) {
  switch (status) {
    case 'running':
      return <Spinner className="text-[10px] text-muted-foreground" />
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-[var(--destructive)]" />
  }
}

// Get status text
function getStatusText(status: ToolStatus, t: (key: string) => string): string {
  switch (status) {
    case 'running':
      return t('toolCall.running')
    case 'completed':
      return t('toolCall.completed')
    case 'error':
      return t('toolCall.failed')
  }
}

export const ToolCallCard = memo(function ToolCallCard({
  toolName,
  preview,
  details,
  result,
  status,
  timestamp,
  defaultExpanded = false,
  className = '',
}: ToolCallCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const ToolIcon = getToolIcon(toolName)

  return (
    <div className={`rounded-lg border border-border-light bg-secondary overflow-hidden ${className}`}>
      {/* Header - always visible */}
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="ghost"
        size="sm"
        className="w-full h-auto justify-start gap-2 px-3 py-2 hover:bg-background text-left"
      >
        {/* Expand chevron */}
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />

        {/* Status icon */}
        <StatusIcon status={status} />

        {/* Tool icon */}
        <ToolIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />

        {/* Tool name */}
        <span className="font-medium text-[13px] text-foreground shrink-0">
          {toolName}
        </span>

        {/* Preview text (truncated) */}
        <span className="text-[13px] text-muted-foreground truncate flex-1">
          {preview}
        </span>

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </Button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border/30 px-3 py-2.5 space-y-2">
          {/* Status line */}
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-muted-foreground">{t('toolCall.status')}:</span>
            <span className={
              status === 'error' 
                ? 'text-[var(--destructive)]' 
                : status === 'completed' 
                  ? 'text-[var(--success)]' 
                  : 'text-muted-foreground'
            }>
              {getStatusText(status, t)}
            </span>
          </div>

          {/* Input details */}
          {details && (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {t('toolCall.input')}
              </span>
              <pre className="text-[12px] text-foreground/80 bg-background/50 rounded-md p-2.5 overflow-x-auto max-h-40 font-mono">
                {details}
              </pre>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {t('toolCall.output')}
              </span>
              <pre className="text-[12px] text-foreground/80 bg-background/50 rounded-md p-2.5 overflow-x-auto max-h-40 font-mono whitespace-pre-wrap">
                {result.length > 500 ? result.substring(0, 500) + '...' : result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default ToolCallCard
