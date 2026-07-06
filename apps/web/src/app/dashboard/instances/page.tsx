"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import type { InstanceNetworking } from "@/lib/instance"
import {
  Server,
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  Activity,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
} from "lucide-react"

function ActionButton({
  title,
  onClick,
  href,
  children,
  className = "",
}: {
  title: string
  onClick?: () => void
  href?: string
  children: React.ReactNode
  className?: string
}) {
  const cls = `inline-flex items-center justify-center rounded-md w-7 h-7 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground ${className}`
  if (href) {
    return (
      <Link href={href} title={title} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  )
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<InstanceNetworking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function fetchInstances() {
    try {
      const data = await api.get<InstanceNetworking[]>("/instances")
      setInstances(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstances()
  }, [])

  async function handleAction(id: string, action: "start" | "stop" | "restart" | "delete") {
    try {
      if (action === "delete") {
        await api.delete(`/instances/${id}`)
      } else {
        await api.post(`/instances/${id}/${action}`)
      }
      fetchInstances()
    } catch {}
  }

  const filtered = instances.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((i) => i.id)))
  }

  return (
    <>
      <Header
        title="Instances"
        breadcrumbs={[{ label: "Compute", href: "/dashboard/instances" }]}
      />
      <div className="p-6">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-medium">Instances ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchInstances}
                title="Actualizar lista"
                className="inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent h-8 w-8 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <Link
                href="/dashboard/instances/new"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Launch instance
              </Link>
            </div>
          </div>

          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter instances..."
                className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading instances...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Server className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No instances match your filter" : "No instances yet"}
              </p>
              {!search && (
                <Link
                  href="/dashboard/instances/new"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3"
                >
                  Launch instance
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Name</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">State</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Type</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Public address</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Port</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Created</th>
                    <th className="h-10 px-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((instance) => (
                    <tr key={instance.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selected.has(instance.id)}
                          onChange={() => toggleSelect(instance.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4">
                        <Link href={`/dashboard/instances/${instance.id}`} className="font-medium hover:underline">
                          {instance.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          instance.status === "running" ? "text-green-600" :
                          instance.status === "stopped" ? "text-muted-foreground" : "text-yellow-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            instance.status === "running" ? "bg-green-500" :
                            instance.status === "stopped" ? "bg-muted-foreground" : "bg-yellow-500"
                          }`} />
                          {instance.status}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {instance.memoryLimit}MB / {instance.cpuLimit}vCPU
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {instance.appUrl && instance.status === "running" ? (
                          <a href={instance.appUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline text-primary">
                            {instance.publicHost}:{instance.internalPort}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {instance.internalPort || "—"}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(instance.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <ActionButton title="Terminal web — consola en el navegador" href={`/dashboard/instances/${instance.id}/console`}>
                            <Terminal className="w-3.5 h-3.5" />
                          </ActionButton>
                          <ActionButton title="Monitoreo — CPU, RAM y red" href={`/dashboard/instances/${instance.id}/monitoring`}>
                            <Activity className="w-3.5 h-3.5" />
                          </ActionButton>
                          {instance.status === "stopped" ? (
                            <ActionButton title="Iniciar instancia" onClick={() => handleAction(instance.id, "start")} className="hover:text-green-600">
                              <Play className="w-3.5 h-3.5" />
                            </ActionButton>
                          ) : (
                            <ActionButton title="Detener instancia" onClick={() => handleAction(instance.id, "stop")} className="hover:text-yellow-600">
                              <Square className="w-3.5 h-3.5" />
                            </ActionButton>
                          )}
                          <ActionButton title="Reiniciar instancia" onClick={() => handleAction(instance.id, "restart")}>
                            <RotateCw className="w-3.5 h-3.5" />
                          </ActionButton>
                          <ActionButton
                            title="Eliminar instancia permanentemente"
                            onClick={() => {
                              if (confirm("Delete this instance permanently?"))
                                handleAction(instance.id, "delete")
                            }}
                            className="hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
