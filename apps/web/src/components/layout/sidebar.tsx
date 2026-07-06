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
  Cloud,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Compute",
    items: [
      { href: "/dashboard/instances", label: "Instances", icon: Server },
      { href: "/dashboard/ssh-keys", label: "Key Pairs", icon: Key },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/dashboard/domains", label: "Domains", icon: Globe },
    ],
  },
  {
    label: "Storage",
    items: [
      { href: "/dashboard/backups", label: "Snapshots", icon: HardDrive },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  function handleLogout() {
    localStorage.removeItem("token")
    window.location.href = "/"
  }

  return (
    <aside className="w-[240px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-40">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <Cloud className="w-5 h-5" />
        <span className="font-semibold text-sm tracking-tight">ZynCloud</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-3 mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
