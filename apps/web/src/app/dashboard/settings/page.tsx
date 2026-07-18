"use client"

import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { Server, Shield, Database } from "lucide-react"

const sysInfo = [
  { label: "Version", value: "ZynCloud v0.1.0" },
  { label: "Engine", value: "Docker Engine" },
  { label: "Database", value: "SQLite + Prisma" },
  { label: "Proxy", value: "Nginx" },
  { label: "Runtime", value: "Node.js 20 LTS" },
  { label: "SSL", value: "Let's Encrypt" },
]

const baseImage = [
  { pkg: "Ubuntu", ver: "22.04 LTS" },
  { pkg: "Node.js", ver: "20 LTS" },
  { pkg: "Nginx", ver: "Latest" },
  { pkg: "Tools", ver: "git, vim, curl, htop, wget" },
]

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" breadcrumbs={[{ label: "System" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Settings"
          description="Información del sistema, imagen base y configuración de despliegue."
        />

        {/* System info */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-medium">System information</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {sysInfo.map(({ label, value }) => (
              <div key={label} className="px-4 py-3.5 border-b border-border md:last:border-b-0">
                <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Base image */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Server className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-sm font-medium">Base instance image</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Package</th>
                <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Version</th>
              </tr>
            </thead>
            <tbody>
              {baseImage.map(({ pkg, ver }) => (
                <tr key={pkg} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-sm">{pkg}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{ver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Security */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-sm font-medium">Security</p>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="text-sm font-medium">Authentication</p>
              <p className="text-xs text-muted-foreground mt-0.5">JWT-based with bcrypt password hashing</p>
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
              Active
            </span>
          </div>
        </div>

        {/* Nginx config */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-sm font-medium">Hosting / Nginx</p>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Para desplegar ZynCloud detrás de Nginx configura reverse proxies para ambos servicios:
            </p>
            <pre className="rounded-xl border border-border bg-muted/30 p-4 font-mono text-xs overflow-x-auto leading-relaxed">{`# Frontend (Next.js) — port 3000
server {
    server_name cloud.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Backend (NestJS API) — port 4000
server {
    server_name api.cloud.yourdomain.com;
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}`}</pre>
            <p className="text-xs text-muted-foreground">
              Las apps de instancia usan puertos asignados dinámicamente (10001, 10002, etc.) — apunta cada dominio al puerto del host de su instancia.
            </p>
          </div>
        </div>
      </PageShell>
    </>
  )
}
