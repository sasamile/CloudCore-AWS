"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Server,
  Globe,
  HardDrive,
  Settings,
  LogOut,
  Key,
  Database,
  Monitor,
  BookOpen,
  Rocket,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useMobileNav } from "@/components/layout/mobile-nav"

export const navSections: {
  label: string
  items: { href: string; label: string; icon: LucideIcon }[]
}[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Compute",
    items: [
      { href: "/dashboard/instances", label: "Instances", icon: Server },
      { href: "/dashboard/integrations", label: "Deploy", icon: Rocket },
      { href: "/dashboard/ssh-keys", label: "Key Pairs", icon: Key },
    ],
  },
  {
    label: "Storage",
    items: [
      { href: "/dashboard/storage", label: "Object Storage", icon: Database },
      { href: "/dashboard/storage/docs", label: "API Docs", icon: BookOpen },
      { href: "/dashboard/backups", label: "Snapshots", icon: HardDrive },
    ],
  },
  {
    label: "Network",
    items: [{ href: "/dashboard/domains", label: "Domains", icon: Globe }],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/host-console", label: "Server Console", icon: Monitor },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
]

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard/storage") return pathname === "/dashboard/storage"
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
}

function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  function handleLogout() {
    localStorage.removeItem("token")
    window.location.href = "/"
  }

  return (
    <>
      <nav className="flex-1 overflow-y-auto p-3">
        {navSections.map((section, index) => (
          <div key={section.label}>
            {index > 0 && <Separator className="my-3 bg-sidebar-border" />}
            <div className="px-2 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-2 border-transparent"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-4 h-4",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </>
  )
}

export function Sidebar() {
  const { open, setOpen } = useMobileNav()

  return (
    <>
      <aside className="hidden lg:flex w-[250px] h-screen bg-sidebar border-r border-sidebar-border flex-col fixed left-0 top-0 z-40">
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
          <Logo size={28} showWordmark />
        </div>
        <SidebarNavContent />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] sm:max-w-[280px] p-0 bg-sidebar border-sidebar-border">
          <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
            <Logo size={28} showWordmark />
          </div>
          <div className="flex flex-col h-[calc(100%-3.5rem)]">
            <SidebarNavContent onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
