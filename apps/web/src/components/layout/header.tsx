"use client"

import { Moon, Sun, Menu } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useMobileNav } from "@/components/layout/mobile-nav"

interface HeaderProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function Header({ title, breadcrumbs }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { setOpen } = useMobileNav()

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 gap-3">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 -ml-1"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 shrink-0">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-2 shrink-0">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{crumb.label}</span>
                  )}
                  <span className="text-muted-foreground/40 select-none">/</span>
                </span>
              ))}
            </nav>
          )}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <span className="md:hidden text-muted-foreground shrink-0">
              {breadcrumbs[breadcrumbs.length - 1]?.label}
              <span className="text-muted-foreground/40 mx-1">/</span>
            </span>
          )}
          <h1 className="font-semibold tracking-tight truncate">{title}</h1>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="text-muted-foreground shrink-0"
        aria-label="Cambiar tema"
      >
        {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </Button>
    </header>
  )
}
