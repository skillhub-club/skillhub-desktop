import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

// Types matching Rust backend
export interface DependencyInfo {
  name: string
  installed: boolean
  version: string | null
  path: string | null
  required: boolean
}

export interface ConfigStatus {
  base_url: string | null
  api_key_set: boolean
  api_key_preview: string | null
}

export interface DependencyStatus {
  package_manager: DependencyInfo
  node: DependencyInfo
  npm: DependencyInfo
  claude_code: DependencyInfo
  config: ConfigStatus
  platform: string
  all_ready: boolean
}

export interface InstallStep {
  id: string
  name: string
  description: string
  command: string
  shell: string
  requires_sudo: boolean
  skip_reason: string | null
}

export interface ManualInstallInstructions {
  step_id: string
  title: string
  instructions: string[]
  docs_url: string | null
}

/**
 * Hook to check and manage Claude Code dependencies
 */
export function useDependencies() {
  const [status, setStatus] = useState<DependencyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<DependencyStatus>('check_dependencies')
      setStatus(result)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Convenience getters
  const isClaudeCodeInstalled = status?.claude_code.installed ?? false
  const isConfigured = status?.config.api_key_set ?? false
  const isReady = status?.all_ready ?? false
  const needsSetup = !loading && (!isClaudeCodeInstalled || !isConfigured)

  return {
    status,
    loading,
    error,
    refresh,
    // Convenience properties
    isClaudeCodeInstalled,
    isConfigured,
    isReady,
    needsSetup,
  }
}

/**
 * Get installation steps for missing dependencies
 */
export async function getInstallSteps(): Promise<InstallStep[]> {
  return invoke<InstallStep[]>('get_install_steps')
}

/**
 * Get a specific installation command
 */
export async function getInstallCommand(stepId: string): Promise<InstallStep> {
  return invoke<InstallStep>('get_install_command', { stepId })
}

/**
 * Configure Claude Code to use SkillHub API
 */
export async function configureClaudeCode(apiKey: string): Promise<void> {
  return invoke('configure_claude_code', { apiKey })
}

/**
 * Remove Claude Code configuration
 */
export async function removeClaudeCodeConfig(): Promise<void> {
  return invoke('remove_claude_code_config')
}

/**
 * API Key validation result
 */
export interface ApiKeyValidationResult {
  valid: boolean
  error_code: string | null
  message: string | null
}

/**
 * Validate an API key against SkillHub API
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  return invoke<ApiKeyValidationResult>('validate_api_key', { apiKey })
}

/**
 * Get manual installation instructions for a step
 */
export async function getManualInstallInstructions(stepId: string): Promise<ManualInstallInstructions> {
  return invoke<ManualInstallInstructions>('get_manual_install_instructions', { stepId })
}
