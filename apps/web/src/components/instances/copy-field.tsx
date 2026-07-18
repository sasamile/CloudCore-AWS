"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7 shrink-0", className)}
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        toast({ title: "Copied" })
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span className="sr-only">Copy</span>
    </Button>
  )
}

export function CopyField({
  label,
  value,
  className,
}: {
  label?: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  )
}
