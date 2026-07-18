import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = "Algo salió mal",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive/80" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4 h-9" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  )
}
