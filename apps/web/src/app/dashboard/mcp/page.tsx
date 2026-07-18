"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check } from "lucide-react"

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
    <div className="relative rounded-xl border border-border overflow-hidden">
      <pre className="overflow-auto bg-muted/30 p-4 text-xs font-mono leading-relaxed">{code}</pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(code)
          setC(true)
          setTimeout(() => setC(false), 1200)
        }}
        className="absolute top-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background/90 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copiar"
      >
        {c ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {c ? "Copiado" : "Copiar"}
      </button>
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
      <Header title="MCP Server" breadcrumbs={[{ label: "System" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Model Context Protocol"
          description="Conecta agentes IA (Claude Desktop, Claude Code) a tu infraestructura. El agente puede crear instancias, buckets y bases de datos por ti."
        />

        <div className="space-y-8">
          {/* Step 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                1
              </span>
              <h3 className="text-sm font-semibold">Registra el servidor en tu cliente MCP</h3>
            </div>
            <p className="text-sm text-muted-foreground pl-7">
              Añade esto a la configuración de Claude Desktop o Claude Code. Tu token de sesión ya está incluido.
            </p>
            <div className="pl-7">
              <CodeBlock code={config} />
              {!token && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Inicia sesión para incrustar tu token automáticamente.
                </p>
              )}
            </div>
          </section>

          {/* Step 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                2
              </span>
              <h3 className="text-sm font-semibold">Probarlo por consola (opcional)</h3>
            </div>
            <div className="pl-7">
              <CodeBlock
                code={`ZYNCLOUD_API_URL=${API_URL} \\
ZYNCLOUD_TOKEN=${tokenPreview} \\
node packages/mcp-server/src/index.ts`}
              />
            </div>
          </section>

          {/* Tools table */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Herramientas disponibles</h3>
            <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {TOOLS.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between px-4 py-3 gap-4 hover:bg-muted/40 transition-colors"
                >
                  <code className="font-mono text-xs">{t.name}</code>
                  <span className="text-xs text-muted-foreground text-right">{t.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">stdio</Badge>
              Protocolo MCP 2024-11-05 · paquete{" "}
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">@zyncloud/mcp</code>
            </p>
          </section>
        </div>
      </PageShell>
    </>
  )
}
