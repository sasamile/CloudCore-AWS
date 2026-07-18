"use client"

import type { RefObject } from "react"
import {
  Code2,
  Container,
  Database,
  GitBranch,
  Layers,
  Package,
  Server,
  Shield,
  Terminal,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { WebTerminalHandle } from "@/components/terminal/web-terminal"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SetupCommand = {
  label: string
  icon: LucideIcon
  command: string
  desc: string
}

type SetupGroup = {
  title: string
  items: SetupCommand[]
}

const GROUPS: SetupGroup[] = [
  {
    title: "Base",
    items: [
      {
        label: "Git",
        icon: GitBranch,
        command: "sudo apt-get update && sudo apt-get install -y git",
        desc: "Version control",
      },
      {
        label: "Build tools",
        icon: Wrench,
        command:
          "sudo apt-get update && sudo apt-get install -y build-essential curl wget unzip zip ca-certificates",
        desc: "gcc, make, curl…",
      },
    ],
  },
  {
    title: "Node.js",
    items: [
      {
        label: "Node.js 20",
        icon: Zap,
        command:
          "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs",
        desc: "LTS runtime",
      },
      {
        label: "npm",
        icon: Package,
        command: "sudo npm install -g npm@latest",
        desc: "Update npm",
      },
      {
        label: "pnpm",
        icon: Package,
        command: "sudo npm install -g pnpm",
        desc: "Package manager",
      },
      {
        label: "Yarn",
        icon: Package,
        command: "sudo npm install -g yarn",
        desc: "Package manager",
      },
      {
        label: "Bun",
        icon: Zap,
        command: "curl -fsSL https://bun.sh/install | bash",
        desc: "Runtime + bundler",
      },
      {
        label: "PM2",
        icon: Layers,
        command: "sudo npm install -g pm2",
        desc: "Process manager",
      },
    ],
  },
  {
    title: "Runtimes",
    items: [
      {
        label: "Python 3",
        icon: Code2,
        command:
          "sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv",
        desc: "Python + pip + venv",
      },
      {
        label: "Go",
        icon: Code2,
        command: "sudo apt-get update && sudo apt-get install -y golang-go",
        desc: "Go compiler",
      },
      {
        label: "PHP 8",
        icon: Code2,
        command:
          "sudo apt-get update && sudo apt-get install -y php php-cli php-fpm php-mysql php-curl php-xml php-mbstring php-zip",
        desc: "PHP + extensions",
      },
      {
        label: "Composer",
        icon: Package,
        command:
          "curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer",
        desc: "PHP deps",
      },
    ],
  },
  {
    title: "Services",
    items: [
      {
        label: "Docker",
        icon: Container,
        command:
          "curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER",
        desc: "Containers",
      },
      {
        label: "Nginx",
        icon: Server,
        command: "sudo apt-get update && sudo apt-get install -y nginx",
        desc: "Reverse proxy",
      },
      {
        label: "Redis",
        icon: Database,
        command: "sudo apt-get update && sudo apt-get install -y redis-server",
        desc: "Cache / queues",
      },
      {
        label: "PostgreSQL",
        icon: Database,
        command:
          "sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib",
        desc: "Database",
      },
      {
        label: "MySQL client",
        icon: Database,
        command: "sudo apt-get update && sudo apt-get install -y mysql-client",
        desc: "MySQL CLI",
      },
      {
        label: "SQLite",
        icon: Database,
        command: "sudo apt-get update && sudo apt-get install -y sqlite3",
        desc: "Lightweight DB",
      },
    ],
  },
  {
    title: "Utilities",
    items: [
      {
        label: "Certbot",
        icon: Shield,
        command:
          "sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx",
        desc: "Let's Encrypt SSL",
      },
      {
        label: "htop",
        icon: Terminal,
        command: "sudo apt-get update && sudo apt-get install -y htop",
        desc: "Process monitor",
      },
      {
        label: "Verify",
        icon: Terminal,
        command:
          "echo '--- Versions ---' && node -v 2>/dev/null; npm -v 2>/dev/null; pnpm -v 2>/dev/null; yarn -v 2>/dev/null; bun -v 2>/dev/null; python3 --version 2>/dev/null; go version 2>/dev/null; php -v 2>/dev/null | head -1; git --version 2>/dev/null; docker --version 2>/dev/null; nginx -v 2>&1; redis-server --version 2>/dev/null; psql --version 2>/dev/null; pm2 -v 2>/dev/null",
        desc: "List installed versions",
      },
    ],
  },
]

interface QuickSetupProps {
  terminalRef: RefObject<WebTerminalHandle | null>
  disabled?: boolean
  className?: string
  /** Called after a command is sent (e.g. close the drawer). */
  onRun?: () => void
}

export function QuickSetup({ terminalRef, disabled, className, onRun }: QuickSetupProps) {
  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-background", className)}>
      <div className="shrink-0 space-y-1 border-b border-border px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Quick setup</p>
        <p className="text-xs text-muted-foreground">Run install commands in the terminal</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className="h-auto w-full justify-start gap-2.5 px-2 py-2 text-left"
                  onClick={() => {
                    terminalRef.current?.sendCommand(item.command)
                    onRun?.()
                  }}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-none">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground truncate">
                      {item.desc}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
