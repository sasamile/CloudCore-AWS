"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
        <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
      </>
    )
  }

  if (!status?.enabled) {
    return (
      <>
        <Header title="Server Console" breadcrumbs={[{ label: "System" }, { label: "Server Console" }]} />
        <div className="p-6 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Consola no disponible
              </CardTitle>
              <CardDescription>
                La consola del servidor no está habilitada en este entorno. Activa{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">HOST_CONSOLE_ENABLED=true</code> en el
                servidor.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Server Console" breadcrumbs={[{ label: "System" }, { label: "Server Console" }]} />
      <div className="p-4 h-[calc(100vh-3.5rem)]">
        <div className="rounded-lg border h-full flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
            />
            <span className="text-xs text-muted-foreground">
              {connected ? "Conectado" : "Conectando..."}
            </span>
            <span className="text-xs text-muted-foreground ml-auto font-mono">
              {status.label} · {status.user}@{status.host}
              {status.mode === "ssh" ? " (SSH)" : " (local)"}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <HostTerminal onConnected={() => setConnected(true)} />
          </div>
        </div>
      </div>
    </>
  )
}
