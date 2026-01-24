import { Download, Play, Square } from 'lucide-react'

import { Button } from '../ui/button'

interface PlaygroundInputBarProps {
  userTask: string
  onUserTaskChange: (value: string) => void
  isRunning: boolean
  canRun: boolean
  onRun: () => void
  onStop: () => void
  runLabel: string
  stopLabel: string
  inputPlaceholder: string
  poweredByLabel: string
  onClose?: () => void
  closeLabel?: string
  onInstall?: () => void
  installLabel?: string
}

export function PlaygroundInputBar({
  userTask,
  onUserTaskChange,
  isRunning,
  canRun,
  onRun,
  onStop,
  runLabel,
  stopLabel,
  inputPlaceholder,
  poweredByLabel,
  onClose,
  closeLabel,
  onInstall,
  installLabel,
}: PlaygroundInputBarProps) {
  return (
    <div className="px-5 py-4 border-t border-border-light">
      <div className="max-w-3xl mx-auto">
        <div className="bg-background rounded-[12px] shadow-middle p-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={userTask}
              onChange={(e) => onUserTaskChange(e.target.value)}
              placeholder={inputPlaceholder}
              className="flex-1 bg-transparent text-foreground text-sm px-4 py-3 focus:outline-none placeholder:text-muted-foreground/60"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isRunning) {
                  e.preventDefault()
                  onRun()
                }
              }}
              disabled={isRunning}
            />
            {isRunning ? (
              <Button
                onClick={onStop}
                className="px-5 py-3 bg-[var(--destructive)] hover:opacity-90 text-white text-sm font-medium rounded-[10px] flex items-center gap-2 transition-colors"
              >
                <Square size={14} />
                {stopLabel}
              </Button>
            ) : (
              <Button
                onClick={onRun}
                disabled={!canRun}
                className="px-5 py-3 bg-foreground hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground text-background text-sm font-medium rounded-[10px] flex items-center gap-2 transition-colors"
              >
                <Play size={14} />
                {runLabel}
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-muted-foreground/60 text-[11px]">{poweredByLabel}</span>
          <div className="flex gap-2">
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-auto px-3 py-1.5 text-muted-foreground hover:text-foreground text-[12px] font-medium"
              >
                {closeLabel ?? 'Close'}
              </Button>
            )}
            {onInstall && (
              <Button
                onClick={onInstall}
                className="px-3 py-1.5 bg-[var(--success)] hover:opacity-90 text-white text-[12px] font-medium rounded-[6px] flex items-center gap-1.5 transition-colors shadow-minimal"
              >
                <Download size={14} />
                {installLabel ?? 'Install'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
