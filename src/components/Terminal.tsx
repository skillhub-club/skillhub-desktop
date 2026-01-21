import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { spawn, IPty } from 'tauri-pty'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  onClose?: () => void
}

export default function Terminal({ onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyRef = useRef<IPty | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const xterm = new XTerm({
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        cursorAccent: '#1a1b26',
        selectionBackground: '#33467c',
        black: '#32344a',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#ad8ee6',
        cyan: '#449dab',
        white: '#787c99',
        brightBlack: '#444b6a',
        brightRed: '#ff7a93',
        brightGreen: '#b9f27c',
        brightYellow: '#ff9e64',
        brightBlue: '#7da6ff',
        brightMagenta: '#bb9af7',
        brightCyan: '#0db9d7',
        brightWhite: '#acb0d0',
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(terminalRef.current)
    fitAddon.fit()

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

    // Welcome message
    xterm.writeln('\x1b[36m╔══════════════════════════════════════╗\x1b[0m')
    xterm.writeln('\x1b[36m║  SkillHub Terminal - PTY Test        ║\x1b[0m')
    xterm.writeln('\x1b[36m╚══════════════════════════════════════╝\x1b[0m')
    xterm.writeln('')
    xterm.writeln('\x1b[90mType a command and press Enter to test.\x1b[0m')
    xterm.writeln('')

    return () => {
      window.removeEventListener('resize', handleResize)
      xterm.dispose()
      xtermRef.current = null
    }
  }, [])

  // Start shell
  const startShell = useCallback(async () => {
    const xterm = xtermRef.current
    if (!xterm || isRunning) return

    try {
      setIsRunning(true)
      xterm.writeln('\x1b[33mStarting shell...\x1b[0m')

      // Use zsh on macOS, bash as fallback
      const shell = '/bin/zsh'

      const pty = await spawn(shell, [], {
        cols: xterm.cols,
        rows: xterm.rows,
      })

      ptyRef.current = pty

      // PTY output -> Terminal
      const dataDisposable = pty.onData((data: string) => {
        xterm.write(data)
      })

      // Terminal input -> PTY
      const inputDisposable = xterm.onData((data: string) => {
        pty.write(data)
      })

      // PTY exit
      const exitDisposable = pty.onExit(({ exitCode }: { exitCode: number }) => {
        xterm.writeln('')
        xterm.writeln(`\x1b[90m[Shell exited with code ${exitCode}]\x1b[0m`)
        setIsRunning(false)
        ptyRef.current = null
        dataDisposable.dispose()
        inputDisposable.dispose()
        exitDisposable.dispose()
      })

    } catch (error) {
      xterm.writeln(`\x1b[31mError: ${error}\x1b[0m`)
      setIsRunning(false)
    }
  }, [isRunning])

  // Run a simple command
  const runCommand = useCallback(async (cmd: string) => {
    const xterm = xtermRef.current
    if (!xterm) return

    try {
      xterm.writeln(`\x1b[36m$ ${cmd}\x1b[0m`)

      const pty = await spawn('/bin/sh', ['-c', cmd], {
        cols: xterm.cols,
        rows: xterm.rows,
      })

      const dataDisp = pty.onData((data: string) => {
        xterm.write(data)
      })

      pty.onExit(({ exitCode }: { exitCode: number }) => {
        xterm.writeln('')
        if (exitCode === 0) {
          xterm.writeln('\x1b[32m✓ Command completed\x1b[0m')
        } else {
          xterm.writeln(`\x1b[31m✗ Exit code: ${exitCode}\x1b[0m`)
        }
        xterm.writeln('')
        dataDisp.dispose()
      })

    } catch (error) {
      xterm.writeln(`\x1b[31mError: ${error}\x1b[0m`)
    }
  }, [])

  // Stop running process
  const stopProcess = useCallback(() => {
    if (ptyRef.current) {
      ptyRef.current.kill()
      ptyRef.current = null
      setIsRunning(false)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1b26] border-2 border-foreground w-[900px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-[#1f2335]">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold">Terminal Test</span>
            <span className={`text-xs px-2 py-0.5 rounded ${isRunning ? 'bg-green-600' : 'bg-gray-600'}`}>
              {isRunning ? 'Running' : 'Idle'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Terminal */}
        <div className="flex-1 p-2">
          <div ref={terminalRef} className="w-full h-full" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-700 bg-[#1f2335]">
          <button
            onClick={() => runCommand('echo "Hello from PTY!"')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          >
            Test: echo
          </button>
          <button
            onClick={() => runCommand('ls -la')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          >
            Test: ls -la
          </button>
          <button
            onClick={() => runCommand('pwd && whoami')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          >
            Test: pwd & whoami
          </button>
          <button
            onClick={startShell}
            disabled={isRunning}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm font-medium rounded"
          >
            Start Shell
          </button>
          {isRunning && (
            <button
              onClick={stopProcess}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
