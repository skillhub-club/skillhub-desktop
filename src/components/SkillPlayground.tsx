import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { spawn, IPty } from 'tauri-pty'
import { invoke } from '@tauri-apps/api/core'
import {
  X, Play, Square, Download,
  MessageSquare, Settings2, PanelRightClose, PanelRight,
  FileText, RotateCcw, AlertTriangle, Wallet, RefreshCw
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import FilePreview from './FilePreview'
import {
  UserMessageBubble,
  QuestionCard,
  Spinner,
  AssistantMessage,
  ToolCallCard,
  type ToolStatus,
} from './playground'
import SetupWizard from './SetupWizard'
import { useDependencies } from '../hooks/useDependencies'
import { useAppStore } from '../store'
import { fetchWallet } from '../api/auth'


const SKILLHUB_URL = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'

interface SkillPlaygroundProps {
  skills: Array<{
    id: string
    name: string
    slug: string
    content?: string
    path?: string
  }>
  onClose?: () => void
  onInstall?: () => void
  variant?: 'modal' | 'embedded'
  className?: string
}

// Types for Claude Code stream-json events
interface ClaudeEvent {
  type: 'system' | 'assistant' | 'user' | 'result'
  subtype?: string
  uuid?: string
  skills?: string[]
  message?: {
    content?: Array<{
      type: 'text' | 'tool_use' | 'tool_result'
      text?: string
      id?: string
      name?: string
      input?: Record<string, unknown>
      tool_use_id?: string
      content?: string
    }>
  }
  result?: string
  duration_ms?: number
  total_cost_usd?: number
  num_turns?: number
  model?: string
  session_id?: string
  is_error?: boolean
}

// Unified conversation event types (选项B: 统一事件流)
type ConversationEventType = 'user_message' | 'assistant_message' | 'tool_call'

interface BaseEvent {
  id: string
  type: ConversationEventType
}

interface UserMessageEvent extends BaseEvent {
  type: 'user_message'
  content: string
}

interface AssistantMessageEvent extends BaseEvent {
  type: 'assistant_message'
  content: string
  isStreaming: boolean
}

interface ToolCallEvent extends BaseEvent {
  type: 'tool_call'
  toolUseId: string
  name: string
  preview: string
  details: string
  status: ToolStatus
  result?: string
}

type ConversationEvent = UserMessageEvent | AssistantMessageEvent | ToolCallEvent

// Question from AskUserQuestion tool
interface PendingQuestion {
  id: string
  toolUseId: string
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description?: string }>
    multiSelect: boolean
  }>
}

// Permission modes available
type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions'
type SkillMode = 'native' | 'system'

interface ArtifactEntry {
  path: string
  toolName: string
  lastUpdated: Date
}

export default function SkillPlayground({
  skills,
  onClose,
  onInstall,
  variant = 'modal',
  className,
}: SkillPlaygroundProps) {
  const { t } = useTranslation()
  const ptyRef = useRef<IPty | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const outputBufferRef = useRef<string>('')
  const tempSkillPathsRef = useRef<string[]>([])
  const initEventFiredRef = useRef(false)

  const [isRunning, setIsRunning] = useState(false)
  const [userTask, setUserTask] = useState('')
  
  // 统一事件流 - 按添加顺序存储所有事件
  const [events, setEvents] = useState<ConversationEvent[]>([])
  const currentAssistantIdRef = useRef<string | null>(null)
  
  const [sessionInfo, setSessionInfo] = useState<{
    model?: string
    sessionId?: string
    skillInjected?: boolean
  }>({})
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string[]>>({})

  // Artifact preview state
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([])
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string | null>(null)
  const [artifactContent, setArtifactContent] = useState('')
  const [artifactLoading, setArtifactLoading] = useState(false)
  const [artifactError, setArtifactError] = useState<string | null>(null)
  const [showArtifacts, setShowArtifacts] = useState(true)

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('acceptEdits')
  const [skillMode, setSkillMode] = useState<SkillMode>('native')
  const [workingDirectory, setWorkingDirectory] = useState('')

  // Dependency check
  const { status: depStatus, loading: depLoading, needsSetup, refresh: refreshDeps } = useDependencies()
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  // Wallet balance
  const { isAuthenticated } = useAppStore()
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  // Show setup wizard if dependencies are missing
  useEffect(() => {
    if (!depLoading && needsSetup) {
      setShowSetupWizard(true)
    }
  }, [depLoading, needsSetup])

  // Load wallet balance on mount and when authenticated
  useEffect(() => {
    const loadWallet = async () => {
      if (!isAuthenticated) {
        setWalletBalance(null)
        return
      }
      
      setWalletLoading(true)
      try {
        const wallet = await fetchWallet()
        setWalletBalance(wallet?.balance ?? null)
      } catch (error) {
        console.error('Failed to fetch wallet:', error)
      } finally {
        setWalletLoading(false)
      }
    }
    
    loadWallet()
  }, [isAuthenticated])

  // Memoize activeSkills to prevent infinite re-renders
  const activeSkills = useMemo(
    () => skills.filter(skill => skill.name.trim().length > 0),
    [skills]
  )

  // 生成唯一 ID
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 添加用户消息
  const addUserMessage = useCallback((content: string) => {
    const event: UserMessageEvent = {
      id: generateId(),
      type: 'user_message',
      content,
    }
    setEvents(prev => [...prev, event])
  }, [generateId])

  // 添加 assistant 消息（开始流式输出）
  const addAssistantMessage = useCallback((content: string, isStreaming = false) => {
    const id = generateId()
    const event: AssistantMessageEvent = {
      id,
      type: 'assistant_message',
      content,
      isStreaming,
    }
    currentAssistantIdRef.current = id
    setEvents(prev => [...prev, event])
    return id
  }, [generateId])

  // 追加内容到当前 assistant 消息
  const appendToAssistant = useCallback((text: string) => {
    const currentId = currentAssistantIdRef.current
    if (!currentId) return
    setEvents(prev => prev.map(event => 
      event.id === currentId && event.type === 'assistant_message'
        ? { ...event, content: event.content + text }
        : event
    ))
  }, [])

  // 结束 assistant 消息流式输出
  const finalizeAssistant = useCallback(() => {
    const currentId = currentAssistantIdRef.current
    if (!currentId) return
    setEvents(prev => prev.map(event => 
      event.id === currentId && event.type === 'assistant_message'
        ? { ...event, isStreaming: false }
        : event
    ))
    currentAssistantIdRef.current = null
  }, [])

  // 添加工具调用
  const addToolCall = useCallback((
    toolUseId: string,
    name: string,
    preview: string,
    details: string
  ) => {
    const event: ToolCallEvent = {
      id: generateId(),
      type: 'tool_call',
      toolUseId,
      name,
      preview,
      details,
      status: 'running',
    }
    setEvents(prev => [...prev, event])
    return event.id
  }, [generateId])

  // 更新工具调用结果
  const updateToolCallResult = useCallback((toolUseId: string, result: string, status: ToolStatus = 'completed') => {
    setEvents(prev => prev.map(event => 
      event.type === 'tool_call' && event.toolUseId === toolUseId
        ? { ...event, result, status }
        : event
    ))
  }, [])

  const addArtifact = useCallback((path: string, toolName: string) => {
    if (!path.trim()) return
    setArtifacts(prev => {
      const existingIndex = prev.findIndex(item => item.path === path)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], toolName, lastUpdated: new Date() }
        return next
      }
      return [...prev, { path, toolName, lastUpdated: new Date() }]
    })
  }, [])

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const escapeShellValue = useCallback((value: string) => {
    return `'${value.replace(/'/g, "'\\''")}'`
  }, [])

  const deriveWorkingDirectory = useCallback((path?: string) => {
    if (!path) return ''
    const claudeMarker = '/.claude/skills/'
    const claudeRoot = '/.claude'
    const index = path.indexOf(claudeMarker)
    if (index !== -1) {
      return path.slice(0, index)
    }
    if (path.endsWith(claudeRoot)) {
      return path.slice(0, -claudeRoot.length)
    }
    const rootIndex = path.indexOf(claudeRoot + '/')
    if (rootIndex !== -1) {
      return path.slice(0, rootIndex)
    }
    return ''
  }, [])

  useEffect(() => {
    if (workingDirectory.trim() || activeSkills.length === 0) return
    const candidate = activeSkills.map(skill => deriveWorkingDirectory(skill.path)).find(Boolean)
    if (candidate) {
      setWorkingDirectory(candidate)
    }
  }, [activeSkills, deriveWorkingDirectory, workingDirectory])

  // Show welcome message on mount
  useEffect(() => {
    if (initEventFiredRef.current) return
    initEventFiredRef.current = true

    const welcomeContent = activeSkills.length === 0
      ? t('playground.canRunWithoutSkills')
      : t('playground.skillsLoaded', { count: activeSkills.length })
    
    const id = addAssistantMessage(welcomeContent, false)
    // 立即结束流式状态
    setEvents(prev => prev.map(event => 
      event.id === id && event.type === 'assistant_message'
        ? { ...event, isStreaming: false }
        : event
    ))
    currentAssistantIdRef.current = null
  }, [activeSkills, addAssistantMessage, t])

  const extractFilePath = (input: Record<string, unknown>): string | null => {
    const directPath = input.file_path ?? input.path ?? input.filePath
    return typeof directPath === 'string' ? directPath : null
  }

  const buildSystemPrompt = useCallback((skillsToUse: typeof skills) => {
    const entries = skillsToUse.filter(skill => skill.content?.trim())
    if (entries.length === 0) return null
    return entries
      .map(skill => `# Skill: ${skill.name}\n\n${skill.content}`)
      .join('\n\n---\n\n')
  }, [])

  const cleanupTempSkills = useCallback(async () => {
    if (tempSkillPathsRef.current.length === 0) return
    const toCleanup = [...tempSkillPathsRef.current]
    tempSkillPathsRef.current = []
    await Promise.all(
      toCleanup.map(path => invoke('uninstall_temp_skill', { skillPath: path }).catch(() => null))
    )
  }, [])

  const loadArtifactContent = useCallback(async (path: string) => {
    setSelectedArtifactPath(path)
    setArtifactLoading(true)
    setArtifactError(null)
    try {
      const content = await invoke<string>('read_file_content', { path })
      setArtifactContent(content)
    } catch (error) {
      setArtifactContent('')
      setArtifactError(error instanceof Error ? error.message : 'Failed to load file')
    } finally {
      setArtifactLoading(false)
    }
  }, [])

  const formatToolInput = (toolName: string, input: Record<string, unknown>): string => {
    switch (toolName) {
      case 'Read':
        return `${input.file_path}`
      case 'Write':
        return `${input.file_path}`
      case 'Edit':
        return `${input.file_path}`
      case 'Bash':
        return `${(input.command as string)?.substring(0, 80) || ''}`
      case 'Glob':
        return `${input.pattern}`
      case 'Grep':
        return `${input.pattern}`
      case 'Skill':
        return `/${input.skill}`
      default:
        return Object.entries(input)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${String(v).substring(0, 40)}`)
          .join(', ')
    }
  }

  // Parse a JSON line from Claude Code output
  const parseClaudeEvent = useCallback((jsonStr: string) => {
    try {
      const event: ClaudeEvent = JSON.parse(jsonStr)

      switch (event.type) {
        case 'system':
          if (event.subtype === 'init') {
            setSessionInfo({
              model: event.model,
              sessionId: event.session_id,
              skillInjected: skillMode === 'system'
            })
          }
          break

        case 'assistant':
          if (event.message?.content) {
            for (const item of event.message.content) {
              if (item.type === 'tool_use' && item.name && item.input) {
                const filePath = extractFilePath(item.input)
                if (filePath && (item.name === 'Read' || item.name === 'Write' || item.name === 'Edit')) {
                  addArtifact(filePath, item.name)
                }
                
                // Check if it's AskUserQuestion
                if (item.name === 'AskUserQuestion') {
                  const input = item.input as { questions?: Array<{
                    question: string
                    header: string
                    options: Array<{ label: string; description?: string }>
                    multiSelect?: boolean
                  }> }

                  if (input.questions && input.questions.length > 0) {
                    setPendingQuestion({
                      id: `q-${Date.now()}`,
                      toolUseId: item.id || '',
                      questions: input.questions.map(q => ({
                        ...q,
                        multiSelect: q.multiSelect || false
                      }))
                    })
                  }
                } else {
                  // Add tool call
                  addToolCall(
                    item.id || `tool-${Date.now()}`,
                    item.name,
                    formatToolInput(item.name, item.input),
                    JSON.stringify(item.input, null, 2)
                  )
                }
              } else if (item.type === 'text' && item.text) {
                // Append text to assistant message
                if (currentAssistantIdRef.current) {
                  appendToAssistant(item.text)
                } else {
                  addAssistantMessage(item.text, true)
                }
              }
            }
          }
          break

        case 'user':
          // This is a tool result
          if (event.message?.content) {
            for (const item of event.message.content) {
              if (item.type === 'tool_result' && item.tool_use_id) {
                const resultContent = typeof item.content === 'string'
                  ? item.content.substring(0, 500)
                  : 'Completed'
                updateToolCallResult(item.tool_use_id, resultContent)
              }
            }
          }
          break

        case 'result':
          finalizeAssistant()
          if (event.is_error && event.result) {
            addAssistantMessage(event.result, false)
          }
          break
      }
    } catch {
      // Not valid JSON, might be partial output
      console.log('Non-JSON output:', jsonStr)
    }
  }, [skillMode, addArtifact, addToolCall, updateToolCallResult, addAssistantMessage, appendToAssistant, finalizeAssistant])

  // Handle answer selection for questions
  const handleAnswerSelect = (questionIndex: number, optionLabel: string, multiSelect: boolean) => {
    setSelectedAnswers(prev => {
      const current = prev[questionIndex] || []
      if (multiSelect) {
        if (current.includes(optionLabel)) {
          return { ...prev, [questionIndex]: current.filter(a => a !== optionLabel) }
        } else {
          return { ...prev, [questionIndex]: [...current, optionLabel] }
        }
      } else {
        return { ...prev, [questionIndex]: [optionLabel] }
      }
    })
  }

  // Submit answers to Claude
  const submitAnswers = useCallback(() => {
    if (!pendingQuestion || !ptyRef.current) return

    const answers: Record<string, string> = {}
    pendingQuestion.questions.forEach((q, idx) => {
      const selected = selectedAnswers[idx] || []
      answers[q.header] = selected.join(', ')
    })

    const response = JSON.stringify({
      type: 'user_input',
      tool_use_id: pendingQuestion.toolUseId,
      answers
    }) + '\n'

    ptyRef.current.write(response)

    // Add user message with the answers
    const answerText = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')
    addUserMessage(answerText)

    setPendingQuestion(null)
    setSelectedAnswers({})
  }, [pendingQuestion, selectedAnswers, addUserMessage])

  // Skip question
  const skipQuestion = useCallback(() => {
    if (!ptyRef.current) return

    ptyRef.current.write('\n')
    addUserMessage(t('playground.skipped'))

    setPendingQuestion(null)
    setSelectedAnswers({})
  }, [addUserMessage, t])

  // Track task start time for duration calculation
  const taskStartTimeRef = useRef<number>(0)

  const runSkillLocal = useCallback(async () => {
    if (!userTask.trim() || isRunning) return

    setIsRunning(true)
    taskStartTimeRef.current = Date.now()
    
    // 清除旧的 artifacts，但保留对话历史
    setArtifacts([])
    setSelectedArtifactPath(null)
    setArtifactContent('')
    setArtifactError(null)
    setPendingQuestion(null)
    setSelectedAnswers({})
    outputBufferRef.current = ''
    await cleanupTempSkills()

    // Add user message
    addUserMessage(userTask)
    
    // Start assistant response
    addAssistantMessage('', true)

    try {
      // Get SkillHub API config env vars
      const envVars = await invoke<Array<[string, string]>>('get_claude_env_vars')
      
      // Build env export prefix
      const envExports = envVars.map(([key, value]) => {
        const escapedValue = value.replace(/'/g, "'\\''")
        return `export ${key}='${escapedValue}'`
      }).join(' && ')

      // Build the claude command with proper escaping
      const escapedTask = userTask.replace(/'/g, "'\\''")

      // Build command parts
      let command = `claude --print --output-format stream-json --verbose`

      // Add permission mode
      command += ` --permission-mode ${permissionMode}`

      if (skillMode === 'system') {
        const prompt = buildSystemPrompt(activeSkills)
        if (prompt) {
          const escapedContent = prompt.replace(/'/g, "'\\''")
          command += ` --system-prompt '${escapedContent}'`
        }
      } else {
        const skillsToInstall = activeSkills.filter(skill => skill.content && !skill.path)
        if (skillsToInstall.length > 0) {
          const tempPaths = await Promise.all(
            skillsToInstall.map(async (skill) => {
              const slug = skill.slug || skill.name.replace(/\s+/g, '-').toLowerCase()
              const tempName = `skillhub-${slug}-${Date.now()}`
              const path = await invoke<string>('install_temp_skill', {
                skillName: tempName,
                content: skill.content ?? ''
              })
              return path
            })
          )
          tempSkillPathsRef.current = tempPaths
        }
      }

      // Add the user's prompt
      command += ` '${escapedTask}'`

      if (workingDirectory.trim()) {
        command = `cd ${escapeShellValue(workingDirectory.trim())} && ${command}`
      }

      // Prepend env vars if any
      if (envExports) {
        command = `${envExports} && ${command}`
      }

      const pty = await spawn('/bin/zsh', ['-l', '-c', command], {
        cols: 120,
        rows: 40,
      })

      ptyRef.current = pty

      const dataDisp = pty.onData((data: string) => {
        outputBufferRef.current += data

        const lines = outputBufferRef.current.split('\n')
        outputBufferRef.current = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed && trimmed.startsWith('{')) {
            parseClaudeEvent(trimmed)
          }
        }
      })

      pty.onExit(({ exitCode }: { exitCode: number }) => {
        if (outputBufferRef.current.trim()) {
          const trimmed = outputBufferRef.current.trim()
          if (trimmed.startsWith('{')) {
            parseClaudeEvent(trimmed)
          }
        }

        // Task completed
        if (exitCode !== 0 && events.length === 0) {
          addAssistantMessage(t('playground.processExited', { code: exitCode }), false)
        }

        setIsRunning(false)
        ptyRef.current = null
        setPendingQuestion(null)
        cleanupTempSkills()
        dataDisp.dispose()
        finalizeAssistant()
      })

    } catch (error) {
      addAssistantMessage(t('playground.failedToStart', { error: String(error) }), false)
      setIsRunning(false)
      cleanupTempSkills()
    }
    
    setUserTask('')
  }, [userTask, isRunning, permissionMode, parseClaudeEvent, addUserMessage, addAssistantMessage, finalizeAssistant, activeSkills, skillMode, buildSystemPrompt, workingDirectory, escapeShellValue, cleanupTempSkills, events.length, t])

  // 直接使用本地运行
  const runSkill = useCallback(() => {
    runSkillLocal()
  }, [runSkillLocal])

  const stopSkill = useCallback(() => {
    if (ptyRef.current) {
      ptyRef.current.kill()
      ptyRef.current = null
      setIsRunning(false)
      setPendingQuestion(null)
      cleanupTempSkills()
      finalizeAssistant()
    }
  }, [cleanupTempSkills, finalizeAssistant])

  // 新建会话 / 重置对话
  const startNewSession = useCallback(() => {
    // 停止当前运行
    if (ptyRef.current) {
      ptyRef.current.kill()
      ptyRef.current = null
    }
    
    // 重置所有状态
    setIsRunning(false)
    setEvents([])
    setArtifacts([])
    setSelectedArtifactPath(null)
    setArtifactContent('')
    setArtifactError(null)
    setPendingQuestion(null)
    setSelectedAnswers({})
    setSessionInfo({})
    currentAssistantIdRef.current = null
    outputBufferRef.current = ''
    
    // 显示欢迎消息
    const welcomeContent = activeSkills.length === 0
      ? t('playground.canRunWithoutSkills')
      : t('playground.skillsLoaded', { count: activeSkills.length })
    
    // 直接设置事件，不使用 addAssistantMessage（避免设置 currentAssistantIdRef）
    setEvents([{
      id: generateId(),
      type: 'assistant_message',
      content: welcomeContent,
      isStreaming: false,
    }])
  }, [activeSkills, generateId, t])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ptyRef.current) {
        ptyRef.current.kill()
      }
      cleanupTempSkills()
    }
  }, [cleanupTempSkills])

  const getPermissionModeLabel = (mode: PermissionMode) => {
    switch (mode) {
      case 'default': return t('playground.askForApproval')
      case 'acceptEdits': return t('playground.autoApproveEdits')
      case 'bypassPermissions': return t('playground.fullAuto')
    }
  }

  // 渲染单个事件
  const renderEvent = (event: ConversationEvent) => {
    switch (event.type) {
      case 'user_message':
        return <UserMessageBubble key={event.id} content={event.content} />
      
      case 'assistant_message':
        return (
          <AssistantMessage 
            key={event.id}
            content={event.content} 
            isStreaming={event.isStreaming}
          />
        )
      
      case 'tool_call':
        return (
          <ToolCallCard
            key={event.id}
            toolName={event.name}
            preview={event.preview}
            details={event.details}
            result={event.result}
            status={event.status}
          />
        )
    }
  }

  return (
    <>
      {/* Setup Wizard Modal */}
      <SetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onComplete={() => {
          setShowSetupWizard(false)
          refreshDeps()
        }}
      />

      <div
        className={variant === 'modal'
          ? 'fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6'
          : `bg-background rounded-[8px] w-full h-full flex flex-col ${className ?? ''}`
        }
        onClick={variant === 'modal' ? onClose : undefined}
      >
        <div
          className={variant === 'modal'
            ? 'bg-background shadow-middle rounded-[8px] w-full max-w-5xl max-h-[85vh] flex flex-col'
            : 'w-full h-full flex flex-col'
          }
          onClick={variant === 'modal' ? (e) => e.stopPropagation() : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t('playground.title')}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {sessionInfo.model && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-[4px] bg-secondary text-muted-foreground">
                    {sessionInfo.model}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {t('playground.skillsActive', { count: activeSkills.length })}
                </span>
                {/* Dependency warning */}
                {depStatus && !depStatus.claude_code.installed && (
                  <button
                    onClick={() => setShowSetupWizard(true)}
                    className="text-[11px] px-1.5 py-0.5 rounded-[4px] bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1"
                  >
                    <AlertTriangle size={10} />
                    {t('playground.setupRequired')}
                  </button>
                )}
                {/* Wallet balance indicator */}
                {isAuthenticated && walletBalance !== null && (
                  <button
                    onClick={() => open(`${SKILLHUB_URL}/web/account/developer`)}
                    className={`text-[11px] px-1.5 py-0.5 rounded-[4px] flex items-center gap-1 transition-colors ${
                      walletBalance < 0.01 
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30' 
                        : 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30'
                    }`}
                    title={walletBalance < 0.01 ? t('setup.insufficientBalance') : t('setup.balanceInfo')}
                  >
                    <Wallet size={10} />
                    ${walletBalance.toFixed(2)}
                    {walletLoading && <RefreshCw size={8} className="animate-spin" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* 新建会话按钮 - 始终可见（有消息时） */}
            {events.length > 0 && (
              <button
                onClick={startNewSession}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-[6px] transition-colors"
                title={t('playground.newSession')}
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              onClick={() => setShowArtifacts(!showArtifacts)}
              className={`p-2 rounded-[6px] transition-colors ${
                showArtifacts
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
              title={showArtifacts ? t('playground.collapsePanel') : t('playground.expandPanel')}
            >
              {showArtifacts ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-[6px] transition-colors ${
                showSettings
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
              title={t('playground.settings')}
            >
              <Settings2 size={18} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-[6px] transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-5 py-3 border-b border-border-light bg-secondary/30">
            <div className="flex flex-col gap-2.5">
              {/* 权限模式 */}
              <div className="flex items-center gap-3">
                <label className="text-[12px] text-muted-foreground w-24">{t('playground.permissions')}</label>
                <div className="flex gap-1.5">
                  {(['default', 'acceptEdits', 'bypassPermissions'] as PermissionMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPermissionMode(mode)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-[5px] transition-colors shadow-minimal ${
                        permissionMode === mode
                          ? 'bg-foreground text-background'
                          : 'bg-background text-foreground hover:bg-secondary'
                      }`}
                    >
                      {getPermissionModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </div>
              {/* 技能模式 */}
              <div className="flex items-center gap-3">
                <label className="text-[12px] text-muted-foreground w-24">{t('playground.skillMode')}</label>
                <div className="flex gap-1.5">
                  {(['native', 'system'] as SkillMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSkillMode(mode)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-[5px] transition-colors shadow-minimal ${
                        skillMode === mode
                          ? 'bg-foreground text-background'
                          : 'bg-background text-foreground hover:bg-secondary'
                      }`}
                    >
                      {mode === 'native' ? t('playground.native') : t('playground.systemPrompt')}
                    </button>
                  ))}
                </div>
              </div>
              {/* 工作目录 */}
              <div className="flex items-center gap-3">
                <label className="text-[12px] text-muted-foreground w-24">{t('playground.workingDir')}</label>
                <input
                  value={workingDirectory}
                  onChange={(e) => setWorkingDirectory(e.target.value)}
                  placeholder={t('playground.workingDirPlaceholder')}
                  className="flex-1 bg-background text-foreground px-2.5 py-1 rounded-[5px] shadow-minimal text-[11px] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Messages Area - Claude.ai style conversation */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Running Status Indicator */}
            {isRunning && (
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border-light">
                <div className="max-w-3xl mx-auto px-6 py-2 flex items-center justify-center gap-2">
                  <Spinner className="text-[10px]" />
                  <span className="text-[12px] text-muted-foreground font-medium">
                    {t('playground.running')}
                  </span>
                </div>
              </div>
            )}
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-4 flex-1">
              {/* Empty state */}
              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 py-12">
                  <MessageSquare size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">{t('playground.enterTaskAndRun')}</p>
                  <p className="text-xs mt-1 text-muted-foreground/40">{t('playground.claudeShowsActions')}</p>
                </div>
              )}

              {/* 按顺序渲染所有事件 */}
              {events.map(event => renderEvent(event))}

              {/* Pending question */}
              {pendingQuestion && (
                <QuestionCard
                  questions={pendingQuestion.questions.map(q => ({
                    question: q.question,
                    header: q.header,
                    options: q.options,
                    multiSelect: q.multiSelect,
                  }))}
                  onSubmit={(answers) => {
                    Object.keys(answers).forEach(key => {
                      const idx = parseInt(key)
                      const selected = answers[idx]
                      if (selected && selected.length > 0) {
                        selected.forEach(label => {
                          handleAnswerSelect(idx, label, pendingQuestion.questions[idx].multiSelect)
                        })
                      }
                    })
                    submitAnswers()
                  }}
                  onSkip={skipQuestion}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Artifacts Panel - Collapsible */}
          {showArtifacts && (
            <div className="w-80 border-l border-border-light flex flex-col bg-secondary/30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-muted-foreground" />
                  <h3 className="text-[13px] font-medium text-foreground">{t('playground.artifacts')}</h3>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded-[4px] bg-secondary text-muted-foreground">
                  {artifacts.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {artifacts.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground/60 text-center py-8">
                    {t('playground.artifactsAppear')}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {artifacts.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => loadArtifactContent(item.path)}
                        className={`w-full text-left px-3 py-2 rounded-[6px] transition-colors ${
                          selectedArtifactPath === item.path
                            ? 'bg-foreground text-background'
                            : 'bg-background hover:bg-secondary'
                        }`}
                      >
                        <div className={`text-[12px] font-medium truncate ${
                          selectedArtifactPath === item.path ? '' : 'text-foreground'
                        }`}>
                          {item.path.split('/').pop() || item.path}
                        </div>
                        <div className={`text-[10px] truncate ${
                          selectedArtifactPath === item.path ? 'opacity-70' : 'text-muted-foreground'
                        }`}>
                          {item.toolName}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* File preview */}
                {selectedArtifactPath && (
                  <div className="mt-4">
                    {artifactLoading && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Spinner className="text-[8px]" />
                        {t('common.loading')}
                      </div>
                    )}
                    {artifactError && (
                      <div className="text-[11px] text-[var(--destructive)]">{artifactError}</div>
                    )}
                    {!artifactLoading && !artifactError && (
                      <FilePreview
                        filename={selectedArtifactPath.split('/').pop() || selectedArtifactPath}
                        content={artifactContent}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Container - Fixed at bottom */}
        <div className="px-5 py-4 border-t border-border-light">
          <div className="max-w-3xl mx-auto">
            <div className="bg-background rounded-[12px] shadow-middle p-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userTask}
                  onChange={(e) => setUserTask(e.target.value)}
                  placeholder={t('playground.describeTask')}
                  className="flex-1 bg-transparent text-foreground text-sm px-4 py-3
                             focus:outline-none
                             placeholder:text-muted-foreground/60"
                  onKeyDown={(e) => {
                    // Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS) to send
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isRunning) {
                      e.preventDefault()
                      runSkill()
                    }
                  }}
                  disabled={isRunning}
                />
                {isRunning ? (
                  <button
                    onClick={stopSkill}
                    className="px-5 py-3 bg-[var(--destructive)] hover:opacity-90
                               text-white text-sm font-medium rounded-[10px] flex items-center gap-2 transition-colors"
                  >
                    <Square size={14} />
                    {t('playground.stop')}
                  </button>
                ) : (
                  <button
                    onClick={runSkill}
                    disabled={!userTask.trim()}
                    className="px-5 py-3 bg-foreground hover:bg-foreground/90
                               disabled:bg-muted disabled:text-muted-foreground
                               text-background text-sm font-medium rounded-[10px] flex items-center gap-2 transition-colors"
                  >
                    <Play size={14} />
                    {t('playground.run')}
                  </button>
                )}
              </div>
            </div>
            {/* Footer info */}
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-muted-foreground/60 text-[11px]">
                {t('playground.poweredBy', { engine: t('playground.claudeCode') })}
              </span>
              <div className="flex gap-2">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-muted-foreground hover:text-foreground
                               text-[12px] font-medium rounded-[6px] transition-colors"
                  >
                    {t('common.close')}
                  </button>
                )}
                {onInstall && (
                  <button
                    onClick={onInstall}
                    className="px-3 py-1.5 bg-[var(--success)] hover:opacity-90
                               text-white text-[12px] font-medium rounded-[6px] flex items-center gap-1.5 transition-colors shadow-minimal"
                  >
                    <Download size={14} />
                    {t('playground.install')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
