"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { api } from "@/lib/api"
import { ConsoleSkeleton } from "@/components/skeletons/page-skeletons"
import { Monitor, AlertTriangle } from "lucide-react"

const HostTerminal = dynamic(
  () => import("@/components/terminal/host-terminal").then((m) => m.HostTerminal),
  { ssr: false }
)

interface HostConsoleStatus {
  enabled: boolean
  mode: string
  host: string
  user: string
  label: string
}

export default function HostConsolePage() {
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<HostConsoleStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<HostConsoleStatus>("/host-console/status")
      .then(setStatus)
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <>
        <Header title="Server Console" breadcrumbs={[{ label: "System" }, { label: "Server Console" }]} />
        <PageShell maxWidth="full" className="py-4">
          <ConsoleSkeleton />
        </PageShell>
      </>
    )
  }

  if (!status?.enabled) {
    return (
      <>
        <Header title="Server Console" breadcrumbs={[{ label: "System" }, { label: "Server Console" }]} />
        <PageShell maxWidth="full">
          <PageHeader
            title="Server Console"
            description="Acceso directo al terminal del servidor host"
          />
          <EmptyState
            icon={AlertTriangle}
            title="Consola no disponible"
            description="La consola del servidor no está habilitada en este entorno. Activa HOST_CONSOLE_ENABLED=true en el servidor."
          />
        </PageShell>
      </>
    )
  }

  return (
    <>
      <Header title="Server Console" breadcrumbs={[{ label: "System" }, { label: "Server Console" }]} />
      <PageShell maxWidth="full" className="py-4 space-y-4">
        <PageHeader
          title="Server Console"
          description={`${status.label} · ${status.user}@${status.host}${status.mode === "ssh" ? " (SSH)" : " (local)"}`}
        />
        <div className="rounded-2xl border border-border h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
            />
            <span className="text-xs text-muted-foreground">
              {connected ? "Conectado" : "Conectando..."}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <HostTerminal onConnected={() => setConnected(true)} />
          </div>
        </div>
      </PageShell>
    </>
  )
}
