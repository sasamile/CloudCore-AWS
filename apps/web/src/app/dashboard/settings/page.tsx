"use client"

import { Header } from "@/components/layout/header"
import { Server, Info, Shield, Database } from "lucide-react"

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" breadcrumbs={[{ label: "System" }]} />
      <div className="p-6 space-y-4 max-w-3xl">
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Info className="w-4 h-4" />
            <h2 className="text-sm font-medium">System information</h2>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm">
            {[
              ["Version", "ZynCloud v0.1.0"],
              ["Engine", "Docker Engine"],
              ["Database", "SQLite + Prisma"],
              ["Proxy", "Nginx"],
              ["Runtime", "Node.js 20 LTS"],
              ["SSL", "Let's Encrypt"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="text-xs font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Server className="w-4 h-4" />
            <h2 className="text-sm font-medium">Base instance image</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Package</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Version</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Ubuntu", "22.04 LTS"],
                  ["Node.js", "20 LTS"],
                  ["Nginx", "Latest"],
                  ["Tools", "git, vim, curl, htop, wget"],
                ].map(([pkg, ver]) => (
                  <tr key={pkg} className="border-b last:border-0">
                    <td className="p-4 text-xs">{pkg}</td>
                    <td className="p-4 text-xs text-muted-foreground">{ver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Shield className="w-4 h-4" />
            <h2 className="text-sm font-medium">Security</h2>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Authentication</p>
              <p className="text-xs text-muted-foreground">JWT-based with bcrypt password hashing</p>
            </div>
            <span className="inline-flex items-center text-xs font-medium text-green-600">Active</span>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Database className="w-4 h-4" />
            <h2 className="text-sm font-medium">Hosting / Nginx</h2>
          </div>
          <div className="p-4 text-xs text-muted-foreground space-y-3">
            <p>To deploy ZynCloud behind Nginx, configure reverse proxies for both services:</p>
            <pre className="bg-muted/50 border rounded-md p-3 font-mono text-xs overflow-x-auto">{`# Frontend (Next.js) — port 3000
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
            <p>Instance apps use dynamically assigned ports (10001, 10002, etc.) — proxy each domain to its instance&apos;s host port.</p>
          </div>
        </div>
      </div>
    </>
  )
}
