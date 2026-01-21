import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { spawn, IPty } from 'tauri-pty'
import {
  X, Check, Circle, Loader2, AlertCircle,
  Terminal, ExternalLink, Key, ChevronRight, Copy, RefreshCw,
  Wallet, Settings2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { open } from '@tauri-apps/plugin-shell'
import { useAppStore } from '../store'
import { fetchWallet } from '../api/auth'

import '@xterm/xterm/css/xterm.css'

const SKILLHUB_URL = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'

// Types matching Rust backend
interface DependencyInfo {
  name: string
  installed: boolean
  version: string | null
  path: string | null
  required: boolean
}

interface ConfigStatus {
  base_url: string | null
  api_key_set: boolean
  api_key_preview: string | null
}

interface DependencyStatus {
  package_manager: DependencyInfo
  node: DependencyInfo
  npm: DependencyInfo
  claude_code: DependencyInfo
  config: ConfigStatus
  platform: string
  all_ready: boolean
}

interface InstallStep {
  id: string
  name: string
  description: string
  command: string
  shell: string
  requires_sudo: boolean
  skip_reason: string | null
}

interface ManualInstallInstructions {
  step_id: string
  title: string
  instructions: string[]
  docs_url: string | null
}

type WizardStep = 'checking' | 'install' | 'configure' | 'complete'

interface SetupWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function SetupWizard({ isOpen, onClose, onComplete }: SetupWizardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAppStore()
  
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>('checking')
  const [status, setStatus] = useState<DependencyStatus | null>(null)
  const [installSteps, setInstallSteps] = useState<InstallStep[]>([])
  const [currentInstallIndex, setCurrentInstallIndex] = useState(0)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [showManualInstructions, setShowManualInstructions] = useState<ManualInstallInstructions | null>(null)
  
  // API Key configuration
  const [apiKey, setApiKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  
  // Wallet balance
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  
  // Terminal refs
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyRef = useRef<IPty | null>(null)

  // Check dependencies on mount
  useEffect(() => {
    if (isOpen) {
      checkDependencies()
    }
  }, [isOpen])

  const checkDependencies = async () => {
    setCurrentStep('checking')
    try {
      const result = await invoke<DependencyStatus>('check_dependencies')
      setStatus(result)
      
      // If all dependencies installed, check if config is needed
      if (result.claude_code.installed) {
        if (!result.config.api_key_set) {
          setCurrentStep('configure')
        } else {
          setCurrentStep('complete')
        }
      } else {
        // Need to install dependencies
        const steps = await invoke<InstallStep[]>('get_install_steps')
        setInstallSteps(steps)
        setCurrentStep('install')
      }
    } catch (error) {
      console.error('Failed to check dependencies:', error)
    }
  }

  // Initialize terminal for installation
  useEffect(() => {
    if (currentStep !== 'install' || !terminalRef.current || xtermRef.current) return

    const xterm = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(terminalRef.current)
    
    // Delay fit to ensure container is rendered
    setTimeout(() => fitAddon.fit(), 100)

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
      if (ptyRef.current) {
        ptyRef.current.resize(xterm.cols, xterm.rows)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      xterm.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [currentStep])

  // Run installation command
  const runInstallCommand = useCallback(async (step: InstallStep) => {
    const xterm = xtermRef.current
    if (!xterm || !step.command) return

    setIsInstalling(true)
    setInstallError(null)

    xterm.writeln('')
    xterm.writeln(`\x1b[36m━━━ Installing ${step.name} ━━━\x1b[0m`)
    xterm.writeln(`\x1b[90m${step.description}\x1b[0m`)
    xterm.writeln('')
    xterm.writeln(`\x1b[33m$ ${step.command}\x1b[0m`)
    xterm.writeln('')

    try {
      const shell = step.shell === 'powershell' ? 'powershell' : '/bin/zsh'
      const args = step.shell === 'powershell' 
        ? ['-Command', step.command]
        : ['-l', '-c', step.command]

      const pty = await spawn(shell, args, {
        cols: xterm.cols,
        rows: xterm.rows,
      })

      ptyRef.current = pty

      // PTY output -> Terminal
      const dataDisp = pty.onData((data: string) => {
        xterm.write(data)
      })

      // Handle user input (for sudo password, etc.)
      const inputDisp = xterm.onData((data: string) => {
        pty.write(data)
      })

      pty.onExit(async ({ exitCode }: { exitCode: number }) => {
        dataDisp.dispose()
        inputDisp.dispose()
        ptyRef.current = null

        xterm.writeln('')
        
        if (exitCode === 0) {
          xterm.writeln(`\x1b[32m✓ ${step.name} installed successfully\x1b[0m`)
          
          // Move to next step or check dependencies again
          const nextIndex = currentInstallIndex + 1
          const remainingSteps = installSteps.slice(nextIndex).filter(s => !s.skip_reason)
          
          if (remainingSteps.length > 0) {
            setCurrentInstallIndex(nextIndex)
            setIsInstalling(false)
          } else {
            // All done, recheck dependencies
            xterm.writeln('')
            xterm.writeln('\x1b[36mVerifying installation...\x1b[0m')
            
            // Wait a bit for PATH to update
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const newStatus = await invoke<DependencyStatus>('check_dependencies')
            setStatus(newStatus)
            
            if (newStatus.claude_code.installed) {
              xterm.writeln('\x1b[32m✓ All dependencies installed!\x1b[0m')
              setIsInstalling(false)
              
              if (!newStatus.config.api_key_set) {
                setTimeout(() => setCurrentStep('configure'), 1000)
              } else {
                setTimeout(() => setCurrentStep('complete'), 1000)
              }
            } else {
              setIsInstalling(false)
              setInstallError('Installation completed but verification failed. You may need to restart the app.')
            }
          }
        } else {
          xterm.writeln(`\x1b[31m✗ Installation failed (exit code: ${exitCode})\x1b[0m`)
          setInstallError(`Installation failed with exit code ${exitCode}`)
          setIsInstalling(false)
        }
      })

    } catch (error) {
      xterm.writeln(`\x1b[31mError: ${error}\x1b[0m`)
      setInstallError(String(error))
      setIsInstalling(false)
    }
  }, [currentInstallIndex, installSteps])

  // Show manual instructions
  const showManualInstall = async (stepId: string) => {
    try {
      const instructions = await invoke<ManualInstallInstructions>('get_manual_install_instructions', { stepId })
      setShowManualInstructions(instructions)
    } catch (error) {
      console.error('Failed to get manual instructions:', error)
    }
  }

  // API Key validation result type
  interface ApiKeyValidationResult {
    valid: boolean
    error_code: string | null
    message: string | null
  }

  // Get user-friendly error message
  const getErrorMessage = (error: unknown): string => {
    const errorStr = String(error).toLowerCase()
    
    if (errorStr.includes('network') || errorStr.includes('fetch') || errorStr.includes('connection')) {
      return t('setup.networkError')
    }
    if (errorStr.includes('500') || errorStr.includes('502') || errorStr.includes('503')) {
      return t('setup.serverError')
    }
    if (errorStr.includes('429') || errorStr.includes('rate')) {
      return t('setup.rateLimited')
    }
    if (errorStr.includes('401') || errorStr.includes('unauthorized')) {
      return t('setup.sessionExpired')
    }
    
    return String(error) || t('setup.unknownError')
  }

  // Fetch wallet balance
  const loadWalletBalance = async () => {
    if (!isAuthenticated) return
    
    try {
      const wallet = await fetchWallet()
      setWalletBalance(wallet?.balance ?? null)
    } catch (error) {
      console.error('Failed to fetch wallet:', error)
    }
  }

  // Configure API Key
  const handleConfigure = async () => {
    if (!apiKey.trim()) return

    setIsValidating(true)
    setValidationError(null)

    try {
      // Validate API key
      const result = await invoke<ApiKeyValidationResult>('validate_api_key', { apiKey: apiKey.trim() })
      
      if (!result.valid) {
        setValidationError(result.message || t('setup.invalidApiKey'))
        setIsValidating(false)
        return
      }

      // Key is valid - show warning if insufficient balance but still allow configuration
      if (result.error_code === 'insufficient_balance') {
        // Key is valid but needs balance - we'll still configure it
        console.log('API key valid but insufficient balance')
      }

      setIsValidating(false)
      setIsConfiguring(true)

      // Configure Claude Code
      await invoke('configure_claude_code', { apiKey: apiKey.trim() })
      
      // Load wallet balance after configuration
      await loadWalletBalance()
      
      setIsConfiguring(false)
      setCurrentStep('complete')
    } catch (error) {
      setValidationError(getErrorMessage(error))
      setIsValidating(false)
      setIsConfiguring(false)
    }
  }

  // Skip configuration
  const handleSkip = () => {
    setCurrentStep('complete')
  }

  // Complete setup
  const handleComplete = () => {
    onComplete()
    onClose()
  }

  // Go to Settings to get API key
  const goToSettings = () => {
    onClose()
    navigate('/settings')
  }

  // Copy text to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-background border-2 border-foreground w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-foreground">
          <div>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
              {t('setup.title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentStep === 'checking' && t('setup.checking')}
              {currentStep === 'install' && t('setup.installing')}
              {currentStep === 'configure' && t('setup.configureApi')}
              {currentStep === 'complete' && t('setup.complete')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step: Checking */}
          {currentStep === 'checking' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('setup.checkingDeps')}</p>
            </div>
          )}

          {/* Step: Install */}
          {currentStep === 'install' && (
            <div className="space-y-4">
              {/* Dependency checklist */}
              <div className="border-2 border-foreground p-4 space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-foreground mb-3">
                  {t('setup.dependencies')}
                </h3>
                
                {status && (
                  <>
                    {/* Package Manager */}
                    {status.platform !== 'windows' && (
                      <DependencyRow
                        name={status.package_manager.name}
                        installed={status.package_manager.installed}
                        version={status.package_manager.version}
                      />
                    )}
                    
                    {/* Node.js */}
                    <DependencyRow
                      name={status.node.name}
                      installed={status.node.installed}
                      version={status.node.version}
                    />
                    
                    {/* npm */}
                    <DependencyRow
                      name={status.npm.name}
                      installed={status.npm.installed}
                      version={status.npm.version}
                    />
                    
                    {/* Claude Code */}
                    <DependencyRow
                      name={status.claude_code.name}
                      installed={status.claude_code.installed}
                      version={status.claude_code.version}
                    />
                  </>
                )}
              </div>

              {/* Terminal output */}
              <div className="border-2 border-foreground overflow-hidden">
                <div className="bg-[#0d1117] px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                  <Terminal size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">Terminal</span>
                </div>
                <div 
                  ref={terminalRef} 
                  className="h-[200px] bg-[#0d1117]"
                  style={{ padding: '8px' }}
                />
              </div>

              {/* Error message */}
              {installError && (
                <div className="border-2 border-red-500 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-500 font-medium">{t('setup.installFailed')}</p>
                      <p className="text-xs text-red-400 mt-1">{installError}</p>
                      <button
                        onClick={() => {
                          const currentStepData = installSteps.find((s, i) => i === currentInstallIndex && !s.skip_reason)
                          if (currentStepData) {
                            showManualInstall(currentStepData.id)
                          }
                        }}
                        className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1"
                      >
                        {t('setup.showManualInstructions')} <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual instructions modal */}
              {showManualInstructions && (
                <div className="border-2 border-foreground bg-secondary/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-foreground">{showManualInstructions.title}</h4>
                    <button
                      onClick={() => setShowManualInstructions(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    {showManualInstructions.instructions.map((instruction, i) => (
                      <li key={i} className="leading-relaxed">
                        {instruction.startsWith('$') || instruction.includes('curl') || instruction.includes('brew') || instruction.includes('npm') ? (
                          <code className="bg-background px-2 py-1 text-xs font-mono">{instruction}</code>
                        ) : (
                          instruction
                        )}
                      </li>
                    ))}
                  </ol>
                  {showManualInstructions.docs_url && (
                    <a
                      href={showManualInstructions.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                    >
                      {t('setup.viewDocs')} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Configure */}
          {currentStep === 'configure' && (
            <div className="space-y-6">
              {/* Success message */}
              <div className="border-2 border-green-500 bg-green-500/10 p-4">
                <div className="flex items-center gap-3">
                  <Check size={20} className="text-green-500" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {t('setup.claudeCodeInstalled')}
                  </p>
                </div>
              </div>

              {/* Benefits */}
              <div className="border-2 border-foreground p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-foreground mb-3">
                  {t('setup.whySkillhubApi')}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check size={14} className="text-green-500" />
                    {t('setup.benefit1')}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check size={14} className="text-green-500" />
                    {t('setup.benefit2')}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check size={14} className="text-green-500" />
                    {t('setup.benefit3')}
                  </li>
                </ul>
              </div>

              {/* API Key input */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground uppercase tracking-wide">
                  {t('setup.apiKey')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-skillhubs-..."
                    className="flex-1 px-4 py-3 border-2 border-foreground bg-background text-foreground font-mono text-sm focus:outline-none"
                  />
                </div>
                {validationError && (
                  <p className="text-xs text-red-500">{validationError}</p>
                )}
              </div>

              {/* Get API Key link */}
              <div className="border-2 border-dashed border-muted-foreground/30 p-4">
                <div className="flex items-start gap-3">
                  <Key size={20} className="text-muted-foreground/50 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {t('setup.noApiKey')}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mb-2">
                      {t('setup.getApiKeySteps')}
                    </p>
                    <button
                      onClick={goToSettings}
                      className="inline-flex items-center gap-1 text-sm font-bold text-foreground hover:underline"
                    >
                      {t('setup.goToSettings')} <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick start code */}
              <div className="border-2 border-foreground p-4 bg-secondary/30">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  {t('setup.configWillAdd')}
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-background border border-border p-2 font-mono text-xs">
                    <span className="flex-1 text-muted-foreground truncate">
                      export ANTHROPIC_BASE_URL="https://www.skillhub.club/api/v1/anthropic"
                    </span>
                    <button 
                      onClick={() => copyToClipboard('export ANTHROPIC_BASE_URL="https://www.skillhub.club/api/v1/anthropic"')}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-background border border-border p-2 font-mono text-xs">
                    <span className="flex-1 text-muted-foreground truncate">
                      export ANTHROPIC_API_KEY="your-api-key"
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {currentStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-500 flex items-center justify-center mb-4">
                <Check size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t('setup.allSet')}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                {status?.config.api_key_set 
                  ? t('setup.readyToUse')
                  : t('setup.readyToUseNoKey')
                }
              </p>
              
              {status?.config.api_key_set && (
                <div className="border-2 border-foreground p-4 mb-6 text-left w-full max-w-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <Check size={14} className="text-green-500" />
                    <span className="text-muted-foreground">{t('setup.configuredWith')}</span>
                  </div>
                  <div className="mt-2 font-mono text-xs text-muted-foreground bg-secondary p-2">
                    {status.config.api_key_preview}
                  </div>
                </div>
              )}

              {/* Wallet Balance */}
              {isAuthenticated && walletBalance !== null && (
                <div className="border-2 border-foreground p-4 mb-6 text-left w-full max-w-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-green-500" />
                      <span className="text-sm font-medium text-foreground">{t('setup.walletBalance')}</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      ${walletBalance.toFixed(4)}
                    </span>
                  </div>
                  {walletBalance < 0.01 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                        {t('setup.insufficientBalance')}
                      </p>
                      <button
                        onClick={() => open(`${SKILLHUB_URL}/web/account/developer`)}
                        className="text-xs font-bold uppercase text-foreground hover:underline flex items-center gap-1"
                      >
                        {t('setup.topUpWallet')} <ExternalLink size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Reconfigure option */}
              {status?.config.api_key_set && (
                <button
                  onClick={() => setCurrentStep('configure')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Settings2 size={12} />
                  {t('setup.reconfigureApi')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-foreground flex items-center justify-between">
          <div>
            {currentStep === 'install' && (
              <button
                onClick={checkDependencies}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={14} />
                {t('setup.recheckDeps')}
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            {currentStep === 'install' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border-2 border-foreground text-foreground font-semibold text-sm uppercase tracking-wide hover:bg-secondary transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    const stepToRun = installSteps.find((s, i) => i >= currentInstallIndex && !s.skip_reason)
                    if (stepToRun) {
                      runInstallCommand(stepToRun)
                    }
                  }}
                  disabled={isInstalling}
                  className="px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('setup.installing')}
                    </>
                  ) : (
                    t('setup.installNow')
                  )}
                </button>
              </>
            )}

            {currentStep === 'configure' && (
              <>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 border-2 border-foreground text-foreground font-semibold text-sm uppercase tracking-wide hover:bg-secondary transition-colors"
                >
                  {t('setup.skipForNow')}
                </button>
                <button
                  onClick={handleConfigure}
                  disabled={!apiKey.trim() || isValidating || isConfiguring}
                  className="px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                >
                  {(isValidating || isConfiguring) ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {isValidating ? t('setup.validating') : t('setup.configuring')}
                    </>
                  ) : (
                    t('setup.configure')
                  )}
                </button>
              </>
            )}

            {currentStep === 'complete' && (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity"
              >
                {t('setup.startUsing')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Dependency row component
function DependencyRow({ 
  name, 
  installed, 
  version 
}: { 
  name: string
  installed: boolean
  version: string | null
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        {installed ? (
          <Check size={16} className="text-green-500" />
        ) : (
          <Circle size={16} className="text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">{name}</span>
      </div>
      <span className="text-xs text-muted-foreground font-mono">
        {installed ? version || 'installed' : 'not installed'}
      </span>
    </div>
  )
}
