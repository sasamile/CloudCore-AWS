"use client"

import { Button } from "@/components/ui/button"
import type { WebTerminalHandle } from "@/components/terminal/web-terminal"
import {
  Package,
  Container,
  GitBranch,
  Terminal,
  Zap,
  Database,
  Server,
  Code2,
  Layers,
  Wrench,
  Shield,
  type LucideIcon,
} from "lucide-react"
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
        desc: "Control de versiones",
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
        desc: "Runtime LTS",
      },
      {
        label: "npm",
        icon: Package,
        command: "sudo npm install -g npm@latest",
        desc: "Actualizar npm",
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
        desc: "Compilador Go",
      },
      {
        label: "PHP 8",
        icon: Code2,
        command:
          "sudo apt-get update && sudo apt-get install -y php php-cli php-fpm php-mysql php-curl php-xml php-mbstring php-zip",
        desc: "PHP + extensiones",
      },
      {
        label: "Composer",
        icon: Package,
        command:
          "curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer",
        desc: "Deps PHP",
      },
    ],
  },
  {
    title: "Servicios",
    items: [
      {
        label: "Docker",
        icon: Container,
        command:
          "curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER",
        desc: "Contenedores",
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
        desc: "Cache / colas",
      },
      {
        label: "PostgreSQL",
        icon: Database,
        command:
          "sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib",
        desc: "Base de datos",
      },
      {
        label: "MySQL client",
        icon: Database,
        command: "sudo apt-get update && sudo apt-get install -y mysql-client",
        desc: "Cliente MySQL",
      },
      {
        label: "SQLite",
        icon: Database,
        command: "sudo apt-get update && sudo apt-get install -y sqlite3",
        desc: "Base de datos ligera",
      },
    ],
  },
  {
    title: "Utilidades",
    items: [
      {
        label: "Certbot",
        icon: Shield,
        command:
          "sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx",
        desc: "SSL Let's Encrypt",
      },
      {
        label: "htop",
        icon: Terminal,
        command: "sudo apt-get update && sudo apt-get install -y htop",
        desc: "Monitor de procesos",
      },
      {
        label: "Verificar",
        icon: Terminal,
        command:
          "echo '--- Versiones ---' && node -v 2>/dev/null; npm -v 2>/dev/null; pnpm -v 2>/dev/null; yarn -v 2>/dev/null; bun -v 2>/dev/null; python3 --version 2>/dev/null; go version 2>/dev/null; php -v 2>/dev/null | head -1; git --version 2>/dev/null; docker --version 2>/dev/null; nginx -v 2>&1; redis-server --version 2>/dev/null; psql --version 2>/dev/null; pm2 -v 2>/dev/null",
        desc: "Ver todo instalado",
      },
    ],
  },
]

interface QuickSetupProps {
  terminalRef: React.RefObject<WebTerminalHandle | null>
  disabled?: boolean
  className?: string
}

export function QuickSetup({ terminalRef, disabled, className }: QuickSetupProps) {
  return (
    <div className={cn("border-l bg-muted/20 w-full lg:w-60 shrink-0 flex flex-col overflow-hidden", className)}>
      <div className="px-3 py-2 border-b">
        <p className="text-xs font-semibold">Setup rápido</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Ejecuta en la consola
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className="w-full justify-start h-auto py-2 px-2 text-left"
                  onClick={() => terminalRef.current?.sendCommand(item.command)}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0 mr-2 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
