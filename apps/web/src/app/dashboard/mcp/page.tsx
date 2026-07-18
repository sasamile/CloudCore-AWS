"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Terminal, Bot } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

const TOOLS = [
  { name: "list_instances", desc: "Lista las instancias del usuario" },
  { name: "create_instance", desc: "Crea una instancia (Ubuntu)" },
  { name: "start_instance", desc: "Enciende una instancia" },
  { name: "stop_instance", desc: "Apaga una instancia" },
  { name: "list_buckets", desc: "Lista buckets de storage" },
  { name: "create_bucket", desc: "Crea un bucket" },
  { name: "list_databases", desc: "Lista bases de datos gestionadas" },
  { name: "create_database", desc: "Aprovisiona una base de datos Postgres" },
]

function CodeBlock({ code }: { code: string }) {
  const [c, setC] = useState(false)
  return (
    <div className="relative rounded-2xl border border-border overflow-hidden">
      <pre className="overflow-auto bg-muted/30 p-4 text-xs font-mono leading-relaxed">{code}</pre>
      <Button
        variant="outline"
        size="icon"
        onClick={() => { navigator.clipboard.writeText(code); setC(true); setTimeout(() => setC(false), 1200) }}
        className="absolute top-2 right-2 h-9 w-9 bg-background/80"
        aria-label="Copiar"
      >
        {c ? <Check className="text-emerald-500" /> : <Copy />}
      </Button>
    </div>
  )
}

export default function McpPage() {
  const [token, setToken] = useState<string>("")

  useEffect(() => {
    setToken(localStorage.getItem("token") || "")
  }, [])

  const tokenPreview = token ? `${token.slice(0, 12)}…${token.slice(-6)}` : "<TU_JWT>"

  const config = `{
  "mcpServers": {
    "zyncloud": {
      "command": "node",
      "args": ["packages/mcp-server/src/index.ts"],
      "env": {
        "ZYNCLOUD_API_URL": "${API_URL}",
        "ZYNCLOUD_TOKEN": "${token || "<TU_JWT_DE_ZYNCLOUD>"}"
      }
    }
  }
}`

  return (
    <>
      <Header title="MCP Server" breadcrumbs={[{ label: "System" }, { label: "MCP" }]} />
      <PageShell maxWidth="3xl">
        <PageHeader
          title="Model Context Protocol"
          description="Conecta agentes IA (Claude Desktop, Claude Code) a tu infraestructura de ZynCloud. El agente podrá crear instancias, buckets y bases de datos por ti."
        />

        <section className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" /> 1. Registra el servidor en tu cliente MCP
          </h3>
          <p className="text-sm text-muted-foreground">
            Añade esto a la configuración de Claude Desktop / Claude Code. Tu token de sesión ya está incluido.
          </p>
          <CodeBlock code={config} />
          {!token && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Inicia sesión para incrustar tu token automáticamente.</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Terminal className="w-4 h-4 text-muted-foreground" /> 2. Probarlo por consola (opcional)
          </h3>
          <CodeBlock code={`ZYNCLOUD_API_URL=${API_URL} \\
ZYNCLOUD_TOKEN=${tokenPreview} \\
node packages/mcp-server/src/index.ts`} />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Herramientas disponibles</h3>
          <div className="rounded-2xl border border-border divide-y divide-border">
            {TOOLS.map((t) => (
              <div key={t.name} className="flex items-center justify-between px-4 py-3 gap-4">
                <code className="font-mono text-sm">{t.name}</code>
                <span className="text-xs text-muted-foreground text-right">{t.desc}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Badge variant="secondary">stdio</Badge>
            Protocolo MCP 2024-11-05 · paquete <code className="text-xs">@zyncloud/mcp</code>
          </div>
        </section>
      </PageShell>
    </>
  )
}
