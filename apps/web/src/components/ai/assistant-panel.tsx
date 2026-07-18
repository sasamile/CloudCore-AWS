"use client"

import { useState } from "react"
import { Bot, Loader2, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
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

export function AssistantPanel({
  instanceId,
  instanceName,
  onClose,
  className,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask about deploy errors, packages, or how to configure this instance.",
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
        ? `Instance: ${instanceName || instanceId}. The user is in the web console for this Ubuntu instance.`
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
    <div className={cn("flex h-full flex-col overflow-hidden bg-background", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold tracking-tight">Assistant</p>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Close</span>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={cn(
              "text-sm leading-relaxed",
              m.role === "user" ? "ml-6 text-right" : "mr-2",
            )}
          >
            {m.role === "user" ? (
              <span className="inline-block rounded-lg bg-muted px-3 py-2 text-left text-foreground">
                {m.content}
              </span>
            ) : (
              <p className="whitespace-pre-wrap text-muted-foreground">{m.content}</p>
            )}
          </div>
        ))}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send()
          }}
          placeholder="How do I deploy my app?"
          className="h-9 text-sm"
          disabled={loading}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
        >
          <Send className="h-3.5 w-3.5" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  )
}
