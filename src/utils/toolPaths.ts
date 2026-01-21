type ToolConfig = {
  configFolder: string
  primarySubdir: string
}

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  claude: { configFolder: '.claude', primarySubdir: 'skills' },
  codex: { configFolder: '.codex', primarySubdir: 'skills' },
  cursor: { configFolder: '.cursor', primarySubdir: 'skills' },
  cline: { configFolder: '.cline', primarySubdir: 'skills' },
  gemini: { configFolder: '.gemini', primarySubdir: 'skills' },
  opencode: { configFolder: '.opencode', primarySubdir: 'skills' },
  kilocode: { configFolder: '.kilocode', primarySubdir: 'skills' },
  copilot: { configFolder: '.copilot', primarySubdir: 'skills' },
  windsurf: { configFolder: '.windsurf', primarySubdir: 'rules' },
  roocode: { configFolder: '.roo', primarySubdir: 'skills' },
  zed: { configFolder: '.zed', primarySubdir: 'rules' },
}

export function getToolConfigFolder(toolId: string, fallbackConfigPath?: string): string {
  const config = TOOL_CONFIGS[toolId]
  if (config) return config.configFolder
  if (fallbackConfigPath) {
    const parts = fallbackConfigPath.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    return last ? `.${last.replace(/^\./, '')}` : '.claude'
  }
  return '.claude'
}

export function getToolPrimarySubdir(toolId: string): string {
  return TOOL_CONFIGS[toolId]?.primarySubdir ?? 'skills'
}

export function buildProjectSkillsPath(projectRoot: string, toolId: string, fallbackConfigPath?: string): string {
  const configFolder = getToolConfigFolder(toolId, fallbackConfigPath)
  const primarySubdir = getToolPrimarySubdir(toolId)
  const root = projectRoot.endsWith('/') ? projectRoot.slice(0, -1) : projectRoot
  return `${root}/${configFolder}/${primarySubdir}`
}
