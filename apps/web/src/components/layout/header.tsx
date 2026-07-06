"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import Link from "next/link"

interface HeaderProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function Header({ title, breadcrumbs }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 sticky top-0 z-30 bg-background">
      <div className="flex items-center gap-1.5 text-sm">
        {breadcrumbs?.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {crumb.href ? (
              <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-muted-foreground">{crumb.label}</span>
            )}
            <span className="text-muted-foreground/50">/</span>
          </span>
        ))}
        <h1 className="font-semibold">{title}</h1>
      </div>
      <button
        onClick={toggleTheme}
        className="inline-flex items-center justify-center rounded-md w-8 h-8 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
      >
        {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>
    </header>
  )
}
