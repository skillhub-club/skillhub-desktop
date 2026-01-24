import { AlertTriangle, PanelRight, PanelRightClose, RefreshCw, RotateCcw, Settings2, Wallet, X } from 'lucide-react'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

interface PlaygroundHeaderProps {
  title: string
  model?: string
  skillsActiveLabel: string
  setupLabel: string
  showSetupWarning: boolean
  onOpenSetup: () => void
  showWallet: boolean
  walletBalanceText: string
  walletIsLow: boolean
  walletLoading: boolean
  walletTitle: string
  onOpenWallet: () => void
  showNewSession: boolean
  onNewSession: () => void
  newSessionTitle: string
  showArtifacts: boolean
  onToggleArtifacts: () => void
  artifactsTitle: string
  showSettings: boolean
  onToggleSettings: () => void
  settingsTitle: string
  onClose?: () => void
}

export function PlaygroundHeader({
  title,
  model,
  skillsActiveLabel,
  setupLabel,
  showSetupWarning,
  onOpenSetup,
  showWallet,
  walletBalanceText,
  walletIsLow,
  walletLoading,
  walletTitle,
  onOpenWallet,
  showNewSession,
  onNewSession,
  newSessionTitle,
  showArtifacts,
  onToggleArtifacts,
  artifactsTitle,
  showSettings,
  onToggleSettings,
  settingsTitle,
  onClose,
}: PlaygroundHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {model && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5">
                {model}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">{skillsActiveLabel}</span>
            {showSetupWarning && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSetup}
                className="h-auto px-1.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/20 hover:bg-amber-500/30"
              >
                <AlertTriangle size={10} />
                {setupLabel}
              </Button>
            )}
            {showWallet && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenWallet}
                className={`h-auto px-1.5 py-0.5 text-[11px] ${
                  walletIsLow
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30'
                    : 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30'
                }`}
                title={walletTitle}
              >
                <Wallet size={10} />
                {walletBalanceText}
                {walletLoading && <RefreshCw size={8} className="animate-spin" />}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {showNewSession && (
          <Button
            variant="ghost"
            size="icon"
          onClick={onNewSession}
          className="h-8 w-8 text-muted-foreground"
          title={newSessionTitle}
        >
            <RotateCcw size={18} />
          </Button>
        )}
        <Button
          variant={showArtifacts ? 'secondary' : 'ghost'}
          size="icon"
          onClick={onToggleArtifacts}
          className={showArtifacts ? 'h-8 w-8 text-foreground' : 'h-8 w-8 text-muted-foreground'}
          title={artifactsTitle}
        >
          {showArtifacts ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
        </Button>
        <Button
          variant={showSettings ? 'secondary' : 'ghost'}
          size="icon"
          onClick={onToggleSettings}
          className={showSettings ? 'h-8 w-8 text-foreground' : 'h-8 w-8 text-muted-foreground'}
          title={settingsTitle}
        >
          <Settings2 size={18} />
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground"
          >
            <X size={18} />
          </Button>
        )}
      </div>
    </div>
  )
}
