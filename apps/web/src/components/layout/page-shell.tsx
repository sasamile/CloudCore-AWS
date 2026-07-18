import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageShellProps {
  children: ReactNode
  className?: string
  /** Ancho máximo del contenido. Default 5xl. */
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full"
}

const maxMap = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-none",
} as const

/** Contenedor de página con gutters consistentes. */
export function PageShell({ children, className, maxWidth = "5xl" }: PageShellProps) {
  return (
    <div
      className={cn(
        "w-full px-4 py-6 sm:px-6 space-y-6",
        maxMap[maxWidth],
        maxWidth !== "full" && "mx-auto",
        className,
      )}
    >
      {children}
    </div>
  )
}
