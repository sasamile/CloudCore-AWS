import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_MAP: Record<
  string,
  { label: string; variant: "success" | "muted" | "destructive" | "secondary"; dot: string }
> = {
  running: { label: "Running", variant: "success", dot: "bg-emerald-500" },
  stopped: { label: "Stopped", variant: "muted", dot: "bg-muted-foreground" },
  creating: { label: "Creating", variant: "secondary", dot: "bg-muted-foreground" },
  error: { label: "Error", variant: "destructive", dot: "bg-destructive" },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    variant: "muted" as const,
    dot: "bg-muted-foreground",
  }

  return (
    <Badge variant={cfg.variant} className={cn("gap-1.5 capitalize", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}
