"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bot, Send, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface AssistantPanelProps {
  instanceId?: string
  instanceName?: string
  onClose?: () => void
  className?: string
}

export function AssistantPanel({ instanceId, instanceName, onClose, className }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola, soy tu asistente de despliegue. Puedo ayudarte con errores de npm, Docker, Git o a configurar tu proyecto.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: "user", content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setLoading(true)
    try {
      const context = instanceId
        ? `Instancia: ${instanceName || instanceId}. El usuario está en la consola web de esta instancia Ubuntu.`
        : undefined
      const res = await api.post<{ content: string; provider: string }>("/ai/chat", {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        context,
      })
      setMessages((prev) => [...prev, { role: "assistant", content: res.content }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: formatApiError(err instanceof Error ? err.message : undefined),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("border-l w-full lg:w-72 shrink-0 flex flex-col bg-background", className)}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold">Asistente IA</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs rounded-lg px-3 py-2 leading-relaxed ${
              m.role === "user"
                ? "bg-primary text-primary-foreground ml-4"
                : "bg-muted/50 mr-2"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando...
          </div>
        )}
      </div>
      <div className="p-2 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="¿Cómo despliego mi app?"
          className="h-8 text-xs"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={loading}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
