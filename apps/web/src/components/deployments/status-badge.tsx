import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CFG = {
  success: { label: "Listo", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", spin: false },
  deploying: { label: "Desplegando", icon: Loader2, color: "text-blue-600 dark:text-blue-400", spin: true },
  building: { label: "Compilando", icon: Loader2, color: "text-blue-600 dark:text-blue-400", spin: true },
  error: { label: "Error", icon: XCircle, color: "text-destructive", spin: false },
  idle: { label: "Sin desplegar", icon: Clock, color: "text-muted-foreground", spin: false },
} as const

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.idle
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
      <Icon className={cn("size-3.5 shrink-0", cfg.spin && "animate-spin")} />
      {cfg.label}
    </span>
  )
}
