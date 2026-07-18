"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { getSocket } from "@/lib/socket"

export interface WebTerminalHandle {
  sendCommand: (command: string) => void
}

interface WebTerminalProps {
  instanceId: string
  onConnected?: () => void
}

export const WebTerminal = forwardRef<WebTerminalHandle, WebTerminalProps>(
  function WebTerminal({ instanceId, onConnected }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const termRef = useRef<Terminal | null>(null)
    const socketRef = useRef<ReturnType<typeof getSocket> | null>(null)
    const [ready, setReady] = useState(false)

    useImperativeHandle(ref, () => ({
      sendCommand(command: string) {
        const cmd = command.endsWith("\n") ? command : `${command}\n`
        termRef.current?.writeln(`\x1b[90m# ${command.replace(/\n/g, " ")}\x1b[0m`)
        socketRef.current?.emit("terminal:input", { instanceId, data: cmd })
      },
    }))

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
          background: "#0c0c0c",
          foreground: "#e5e5e5",
          cursor: "#e5e5e5",
          cursorAccent: "#0c0c0c",
          selectionBackground: "#ffffff30",
          black: "#0c0c0c",
          red: "#f87171",
          green: "#4ade80",
          yellow: "#facc15",
          blue: "#93c5fd",
          magenta: "#c4b5fd",
          cyan: "#67e8f9",
          white: "#e5e5e5",
          brightBlack: "#737373",
          brightRed: "#fca5a5",
          brightGreen: "#86efac",
          brightYellow: "#fde047",
          brightBlue: "#bfdbfe",
          brightMagenta: "#ddd6fe",
          brightCyan: "#a5f3fc",
          brightWhite: "#fafafa",
        },
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.35,
        allowTransparency: false,
      })

      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(el)

      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
        } catch {
          /* fit before layout is ready */
        }
      })

      termRef.current = terminal

      const socket = getSocket()
      socketRef.current = socket

      socket.emit("terminal:connect", { instanceId })

      socket.on("terminal:output", (data: string) => {
        terminal.write(data)
      })

      socket.on("terminal:connected", () => {
        onConnected?.()
        terminal.writeln("\x1b[32mConnected.\x1b[0m\r\n")
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
        try {
          fitAddon.fit()
        } catch {
          /* ignore */
        }
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
        socketRef.current = null
      }
    }, [instanceId, ready, onConnected])

    return <div ref={terminalRef} className="terminal-shell" />
  },
)
