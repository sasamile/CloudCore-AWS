"use client"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2",
            t.variant === "destructive"
              ? "border-destructive/50 bg-destructive text-destructive-foreground"
              : "border-border bg-background text-foreground"
          )}
        >
          {t.title && <p className="text-sm font-medium">{t.title}</p>}
          {t.description && (
            <p className={cn("text-sm", t.title && "mt-1 opacity-90")}>{t.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
