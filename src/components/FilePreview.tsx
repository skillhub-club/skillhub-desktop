import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface FilePreviewProps {
  filename: string
  content: string
}

// Map file extensions to language identifiers
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    // Web
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    
    // Backend
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    scala: 'scala',
    php: 'php',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    
    // Config
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',
    xml: 'xml',
    
    // Shell
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',
    
    // Docs
    md: 'markdown',
    mdx: 'markdown',
    
    // Other
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
  }
  
  // Handle special filenames
  const lowerFilename = filename.toLowerCase()
  if (lowerFilename === 'dockerfile') return 'dockerfile'
  if (lowerFilename === 'makefile') return 'makefile'
  if (lowerFilename.endsWith('.cursorrules') || lowerFilename.endsWith('.mdc')) return 'markdown'
  
  return languageMap[ext] || 'text'
}

function isMarkdown(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const name = filename.toLowerCase()
  return ext === 'md' || ext === 'mdx' || name.endsWith('.cursorrules') || name.endsWith('.mdc') || name === 'skill.md'
}

export default function FilePreview({ filename, content }: FilePreviewProps) {
  const language = useMemo(() => getLanguage(filename), [filename])
  const shouldRenderMarkdown = useMemo(() => isMarkdown(filename), [filename])

  if (!content) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No content available
      </div>
    )
  }

  // Render markdown files with ReactMarkdown
  if (shouldRenderMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-[50vh] p-4 bg-secondary/30 rounded border border-border">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const isInline = !match
              
              if (isInline) {
                return (
                  <code className="px-1.5 py-0.5 bg-secondary rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                )
              }
              
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                  }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            },
            // Style other elements
            h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-foreground">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-bold mt-2 mb-1 text-foreground">{children}</h3>,
            p: ({ children }) => <p className="mb-2 text-foreground leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-foreground">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 text-foreground">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground my-2">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            hr: () => <hr className="border-border my-4" />,
            table: ({ children }) => (
              <div className="overflow-auto">
                <table className="min-w-full border border-border text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="border border-border px-3 py-1.5 bg-secondary text-left font-medium">{children}</th>,
            td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  // Render code files with syntax highlighting
  return (
    <div className="overflow-auto max-h-[50vh] rounded border border-border">
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        showLineNumbers
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: '#636d83',
          userSelect: 'none',
        }}
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          lineHeight: '1.5',
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  )
}
