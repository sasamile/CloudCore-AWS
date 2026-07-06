"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { WebTerminal } from "@/components/terminal/web-terminal"

export default function ConsolePage() {
  const params = useParams()
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [instanceName, setInstanceName] = useState("")

  useEffect(() => {
    api
      .get<{ name: string }>(`/instances/${params.id}`)
      .then((data) => setInstanceName(data.name))
      .catch(() => router.push("/dashboard/instances"))
  }, [params.id, router])

  return (
    <>
      <Header
        title="Console"
        breadcrumbs={[
          { label: "Compute", href: "/dashboard/instances" },
          { label: "Instances", href: "/dashboard/instances" },
          { label: instanceName || "...", href: `/dashboard/instances/${params.id}` },
        ]}
      />
      <div className="p-4 h-[calc(100vh-3.5rem)]">
        <div className="rounded-lg border h-full flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
            <span className="text-xs text-muted-foreground">
              {connected ? "Conectado" : "Conectando..."}
            </span>
            <span className="text-xs text-muted-foreground ml-auto font-mono">{instanceName}</span>
          </div>
          <div className="flex-1 min-h-0">
            <WebTerminal
              instanceId={params.id as string}
              onConnected={() => setConnected(true)}
            />
          </div>
        </div>
      </div>
    </>
  )
}
