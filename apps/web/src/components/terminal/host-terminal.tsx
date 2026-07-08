"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { getSocket } from "@/lib/socket"

interface HostTerminalProps {
  onConnected?: () => void
}

export function HostTerminal({ onConnected }: HostTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!terminalRef.current || termRef.current) return

    const el = terminalRef.current
    if (el.clientWidth === 0 || el.clientHeight === 0) {
      const raf = requestAnimationFrame(() => {
        termRef.current = null
        setReady((r) => !r)
      })
      return () => cancelAnimationFrame(raf)
    }

    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#0a0e1a",
        foreground: "#e2e8f0",
        cursor: "#3b82f6",
        selectionBackground: "#3b82f650",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(el)

    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
      } catch {}
    })

    termRef.current = terminal

    const socket = getSocket()

    socket.emit("host:connect")

    socket.on("host:output", (data: string) => {
      terminal.write(data)
    })

    socket.on("host:connected", () => {
      onConnected?.()
      terminal.writeln("\x1b[32mConectado al servidor.\x1b[0m\r\n")
    })

    socket.on("host:error", (msg: string) => {
      terminal.writeln(`\x1b[31mError: ${msg}\x1b[0m\r\n`)
    })

    terminal.onData((data: string) => {
      socket.emit("host:input", { data })
    })

    terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      socket.emit("host:resize", { cols, rows })
    })

    const handleResize = () => {
      try {
        fitAddon.fit()
      } catch {}
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      socket.emit("host:disconnect")
      socket.off("host:output")
      socket.off("host:connected")
      socket.off("host:error")
      terminal.dispose()
      termRef.current = null
    }
  }, [ready, onConnected])

  return (
    <div
      ref={terminalRef}
      className="terminal-shell"
    />
  )
}
