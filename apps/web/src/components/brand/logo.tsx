import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: number
  showWordmark?: boolean
}

export function Logo({ className, size = 32, showWordmark = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative shrink-0 rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/95 dark:ring-white/10"
        style={{ width: size + 8, height: size + 8 }}
      >
        <Image
          src="/logo.svg"
          alt="ZynCloud"
          width={size}
          height={size}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          priority
        />
      </div>
      {showWordmark && (
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-tight leading-none">ZynCloud</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Console</span>
        </div>
      )}
    </div>
  )
}
