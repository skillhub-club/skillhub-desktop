/**
 * AssistantMessage - Claude.ai style assistant message with Markdown support
 * 
 * Features:
 * - Left-aligned message
 * - Markdown rendering with syntax highlighting
 * - Streaming text support with cursor animation
 * - Copy button on hover
 */

import { useState, useMemo, memo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'

export interface AssistantMessageProps {
  /** Message content (supports Markdown) */
  content: string
  /** Whether the message is still streaming */
  isStreaming?: boolean
  /** Additional className */
  className?: string
}

// Memoized code block component for performance
const CodeBlock = memo(({ language, children }: { language: string; children: string }) => (
  <div className="relative group/code my-3">
    <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
      <CopyButton text={children} size="sm" />
    </div>
    <SyntaxHighlighter
      style={oneDark}
      language={language}
      PreTag="div"
      customStyle={{
        margin: 0,
        borderRadius: '8px',
        fontSize: '13px',
        lineHeight: '1.5',
        padding: '16px',
      }}
    >
      {children.replace(/\n$/, '')}
    </SyntaxHighlighter>
  </div>
))
CodeBlock.displayName = 'CodeBlock'

// Copy button component
function CopyButton({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const sizeClasses = size === 'sm' 
    ? 'p-1.5 text-[11px]' 
    : 'px-2.5 py-1.5 text-[12px]'
  const iconSize = size === 'sm' ? 12 : 14

  return (
    <Button
      onClick={handleCopy}
      variant="ghost"
      size="sm"
      className={`h-auto flex items-center gap-1 rounded-md transition-all ${sizeClasses} ${
        copied
          ? 'bg-[var(--success)]/20 text-[var(--success)]'
          : 'bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background'
      }`}
      title={t('common.copy')}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
    </Button>
  )
}

// Streaming cursor component
function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/70 animate-pulse rounded-sm" />
  )
}

export function AssistantMessage({ 
  content, 
  isStreaming = false,
  className = '' 
}: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Memoize the markdown components to prevent re-renders
  const markdownComponents = useMemo(() => ({
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children || '')
      const isInline = !match && !codeString.includes('\n')
      
      if (isInline) {
        return (
          <code 
            className="px-1.5 py-0.5 bg-secondary/80 rounded text-[13px] font-mono text-foreground" 
            {...props}
          >
            {children}
          </code>
        )
      }
      
      return <CodeBlock language={match?.[1] || 'text'}>{codeString}</CodeBlock>
    },
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-3 last:mb-0 text-foreground leading-relaxed">{children}</p>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-xl font-semibold mt-5 mb-3 text-foreground">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h3>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-outside ml-5 mb-3 space-y-1 text-foreground">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-outside ml-5 mb-3 space-y-1 text-foreground">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-foreground leading-relaxed">{children}</li>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-3 border-border/50 pl-4 my-3 text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a 
        href={href} 
        className="text-blue-500 hover:text-blue-400 underline underline-offset-2" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="border-border/50 my-4" />,
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="border border-border/50 px-3 py-2 bg-secondary/50 text-left font-medium text-foreground">
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="border border-border/50 px-3 py-2 text-foreground">{children}</td>
    ),
  }), [])

  // If content is empty and streaming, show placeholder
  if (!content && isStreaming) {
    return (
      <div className={`flex justify-start w-full ${className}`}>
        <div className="max-w-[85%] py-1">
          <StreamingCursor />
        </div>
      </div>
    )
  }

  // If no content, don't render
  if (!content) return null

  return (
    <div 
      className={`group/msg flex justify-start w-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-[85%] relative">
        {/* Copy button - appears on hover */}
        <div className={`absolute -top-2 right-0 transition-opacity duration-200 ${
          isHovered && !isStreaming ? 'opacity-100' : 'opacity-0'
        }`}>
          <CopyButton text={content} />
        </div>

        {/* Message content with Markdown */}
        <div className="text-[14px] leading-relaxed">
          <ReactMarkdown components={markdownComponents}>
            {content}
          </ReactMarkdown>
          {isStreaming && <StreamingCursor />}
        </div>
      </div>
    </div>
  )
}

export default AssistantMessage
