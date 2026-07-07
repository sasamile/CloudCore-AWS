"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface HeaderProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function Header({ title, breadcrumbs }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 text-sm min-w-0">
        {breadcrumbs?.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2 shrink-0">
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-muted-foreground">{crumb.label}</span>
            )}
            <span className="text-muted-foreground/40">/</span>
          </span>
        ))}
        <h1 className="font-semibold truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Separator orientation="vertical" className="h-5" />
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </div>
    </header>
  )
}
