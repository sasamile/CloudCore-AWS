"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { getSocket } from "@/lib/socket"

interface WebTerminalProps {
  instanceId: string
  onConnected?: () => void
}

export function WebTerminal({ instanceId, onConnected }: WebTerminalProps) {
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
      try { fitAddon.fit() } catch {}
    })

    termRef.current = terminal

    const socket = getSocket()

    socket.emit("terminal:connect", { instanceId })

    socket.on("terminal:output", (data: string) => {
      terminal.write(data)
    })

    socket.on("terminal:connected", () => {
      onConnected?.()
      terminal.writeln("\x1b[32mConectado a la instancia.\x1b[0m\r\n")
    })

    socket.on("terminal:error", (msg: string) => {
      terminal.writeln(`\x1b[31mError: ${msg}\x1b[0m\r\n`)
    })

    terminal.onData((data: string) => {
      socket.emit("terminal:input", { instanceId, data })
    })

    terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      socket.emit("terminal:resize", { instanceId, cols, rows })
    })

    const handleResize = () => {
      try { fitAddon.fit() } catch {}
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      socket.emit("terminal:disconnect", { instanceId })
      socket.off("terminal:output")
      socket.off("terminal:connected")
      socket.off("terminal:error")
      terminal.dispose()
      termRef.current = null
    }
  }, [instanceId, ready])

  return (
    <div
      ref={terminalRef}
      className="w-full h-full rounded-lg overflow-hidden border border-border"
    />
  )
}
