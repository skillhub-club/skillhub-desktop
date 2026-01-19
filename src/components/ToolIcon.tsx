import { useState } from 'react'

interface ToolIconProps {
  toolId: string
  size?: number
  className?: string
}

// Tool icon URLs - using official logos where available
// These can be replaced with local SVGs later
const TOOL_ICONS: Record<string, string> = {
  'claude': 'https://www.anthropic.com/images/icons/apple-touch-icon.png',
  'codex': 'https://openai.com/favicon.ico',
  'cursor': 'https://www.cursor.com/favicon.ico',
  'cline': 'https://cline.bot/favicon.ico',
  'copilot': 'https://github.githubassets.com/favicons/favicon.svg',
  'windsurf': 'https://codeium.com/favicon.svg',
  'aider': 'https://aider.chat/assets/favicon.ico',
  'roocode': 'https://roocode.com/favicon.ico',
  'augment': 'https://www.augmentcode.com/favicon.ico',
  'continue': 'https://continue.dev/favicon.ico',
  'gemini': 'https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png',
  'opencode': 'https://opencode.ai/favicon.ico',
  'kiro': 'https://kiro.dev/favicon.ico',
  'kilocode': 'https://kilocode.ai/favicon.ico',
  'zencoder': 'https://zencoder.ai/favicon.ico',
  'zed': 'https://zed.dev/favicon.ico',
  'vscode': 'https://code.visualstudio.com/favicon.ico',
}

// Fallback colors for tools without icons
const TOOL_COLORS: Record<string, string> = {
  'claude': '#D97706',
  'codex': '#10A37F',
  'cursor': '#000000',
  'cline': '#6366F1',
  'copilot': '#000000',
  'windsurf': '#09B6A2',
  'aider': '#4F46E5',
  'roocode': '#EC4899',
  'augment': '#8B5CF6',
  'continue': '#F59E0B',
  'gemini': '#4285F4',
  'opencode': '#3B82F6',
  'kiro': '#FF6B00',
  'kilocode': '#EF4444',
  'zencoder': '#14B8A6',
  'zed': '#000000',
  'vscode': '#007ACC',
}

// Short names for fallback display
const TOOL_SHORT_NAMES: Record<string, string> = {
  'claude': 'CC',
  'codex': 'CX',
  'cursor': 'CU',
  'cline': 'CL',
  'copilot': 'CP',
  'windsurf': 'WS',
  'aider': 'AI',
  'roocode': 'RC',
  'augment': 'AU',
  'continue': 'CO',
  'gemini': 'GE',
  'opencode': 'OC',
  'kiro': 'KI',
  'kilocode': 'KC',
  'zencoder': 'ZC',
  'zed': 'ZD',
  'vscode': 'VS',
}

export default function ToolIcon({ toolId, size = 24, className = '' }: ToolIconProps) {
  const [imgError, setImgError] = useState(false)
  const iconUrl = TOOL_ICONS[toolId]
  const bgColor = TOOL_COLORS[toolId] || '#6B7280'
  const shortName = TOOL_SHORT_NAMES[toolId] || toolId.slice(0, 2).toUpperCase()

  // If no icon URL or image failed to load, show fallback
  if (!iconUrl || imgError) {
    return (
      <div
        className={`flex items-center justify-center font-bold text-white ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
          fontSize: size * 0.4,
          borderRadius: 4,
        }}
      >
        {shortName}
      </div>
    )
  }

  return (
    <img
      src={iconUrl}
      alt={toolId}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: 4,
      }}
      onError={() => setImgError(true)}
    />
  )
}
