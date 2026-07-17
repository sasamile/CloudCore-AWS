"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plug, Copy, Check, Terminal, Bot } from "lucide-react"

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
    <div className="relative">
      <pre className="overflow-auto rounded-lg bg-[#0a0e1a] text-slate-200 p-4 text-xs font-mono leading-relaxed">{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setC(true); setTimeout(() => setC(false), 1200) }}
        className="absolute top-2 right-2 inline-flex items-center justify-center rounded border border-slate-600 bg-slate-800/80 w-7 h-7 hover:bg-slate-700"
      >
        {c ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
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
      <Header title="MCP Server" breadcrumbs={[{ label: "System" }, { label: "MCP" }]} />
      <div className="w-full max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5"><Plug className="w-5 h-5 text-primary" /></div>
          <div>
            <h2 className="text-xl font-semibold">Model Context Protocol</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conecta agentes IA (Claude Desktop, Claude Code) a tu infraestructura de ZynCloud.
              El agente podrá crear instancias, buckets y bases de datos por ti.
            </p>
          </div>
        </div>

        {/* Paso 1 */}
        <section className="space-y-2">
          <h3 className="font-medium flex items-center gap-2"><Bot className="w-4 h-4" /> 1. Registra el servidor en tu cliente MCP</h3>
          <p className="text-sm text-muted-foreground">
            Añade esto a la configuración de Claude Desktop / Claude Code. Tu token de sesión ya está incluido.
          </p>
          <CodeBlock code={config} />
          {!token && (
            <p className="text-xs text-amber-500">Inicia sesión para incrustar tu token automáticamente.</p>
          )}
        </section>

        {/* Paso 2 */}
        <section className="space-y-2">
          <h3 className="font-medium flex items-center gap-2"><Terminal className="w-4 h-4" /> 2. Probarlo por consola (opcional)</h3>
          <CodeBlock code={`ZYNCLOUD_API_URL=${API_URL} \\
ZYNCLOUD_TOKEN=${tokenPreview} \\
node packages/mcp-server/src/index.ts`} />
        </section>

        {/* Herramientas */}
        <section className="space-y-2">
          <h3 className="font-medium">Herramientas disponibles</h3>
          <div className="rounded-lg border divide-y">
            {TOOLS.map((t) => (
              <div key={t.name} className="flex items-center justify-between px-4 py-2.5">
                <code className="font-mono text-sm">{t.name}</code>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <Badge variant="secondary">stdio</Badge> Protocolo MCP 2024-11-05 · paquete <code className="text-xs">@zyncloud/mcp</code>
          </div>
        </section>
      </div>
    </>
  )
}
