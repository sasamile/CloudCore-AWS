"use client"

import { useEffect, useRef, useState } from "react"
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
  ChevronDown,
  Copy,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TableRowsSkeleton } from "@/components/skeletons/page-skeletons"

function formatInstanceId(id: string) {
  return `i-${id.replace(/-/g, "").slice(0, 12)}`
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "less than a minute ago"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours > 1 ? "s" : ""} ago`
}

function StatusCell({ status }: { status: string }) {
  const isRunning = status === "running"
  const isStopped = status === "stopped"
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        isRunning ? "text-green-600" : isStopped ? "text-muted-foreground" : "text-yellow-600"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isRunning ? "bg-green-500" : isStopped ? "bg-muted-foreground" : "bg-yellow-500"
        }`}
      />
      {isRunning ? "Running" : isStopped ? "Stopped" : status}
    </span>
  )
}

function ToolbarDropdown({
  label,
  disabled,
  children,
}: {
  label: string
  disabled?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        variant={disabled ? "secondary" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="gap-1"
      >
        {label}
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-md border border-border bg-background/95 backdrop-blur-md shadow-lg p-1">
          {children(close)}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  href,
  children,
  destructive,
  disabled,
}: {
  onClick?: () => void
  href?: string
  children: React.ReactNode
  destructive?: boolean
  disabled?: boolean
}) {
  const cls = `flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors ${
    disabled
      ? "opacity-50 pointer-events-none"
      : destructive
        ? "text-destructive hover:bg-destructive/10"
        : "hover:bg-accent hover:text-accent-foreground"
  }`
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<InstanceNetworking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function fetchInstances(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await api.get<InstanceNetworking[]>("/instances")
      setInstances(data)
      setLastUpdated(new Date())
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInstances()
  }, [])

  async function handleAction(id: string, action: "start" | "stop" | "restart" | "delete") {
    try {
      if (action === "delete") {
        if (!confirm("Delete this instance permanently?")) return
        await api.delete(`/instances/${id}`)
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        await api.post(`/instances/${id}/${action}`)
      }
      fetchInstances(true)
    } catch {}
  }

  const filtered = instances.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    formatInstanceId(i.id).toLowerCase().includes(search.toLowerCase())
  )

  const selectedIds = [...selected].filter((id) => filtered.some((i) => i.id === id))
  const selectedInstance =
    selectedIds.length === 1 ? filtered.find((i) => i.id === selectedIds[0]) ?? null : null
  const hasSelection = selectedIds.length > 0
  const canConnect = selectedInstance?.status === "running"

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set())
    else setSelected(new Set(filtered.map((i) => i.id)))
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <>
      <Header
        title="Instances"
        breadcrumbs={[{ label: "Compute", href: "/dashboard/instances" }]}
      />
      <div className="w-full px-4 py-6 sm:px-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Instances ({filtered.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-1">
              <button
                onClick={() => fetchInstances(true)}
                disabled={refreshing}
                title="Refresh"
                className="inline-flex items-center justify-center rounded-full border w-7 h-7 hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <span>Updated {timeAgo(lastUpdated)}</span>
            </div>

            <Button
              variant={canConnect ? "default" : "outline"}
              size="sm"
              disabled={!canConnect}
              title={
                canConnect
                  ? "Abrir consola web"
                  : hasSelection
                    ? "La instancia debe estar en ejecución"
                    : "Selecciona una instancia"
              }
              asChild={canConnect}
            >
              {canConnect ? (
                <Link href={`/dashboard/instances/${selectedInstance!.id}/console`}>
                  <Terminal className="w-3.5 h-3.5" />
                  Connect
                </Link>
              ) : (
                <>
                  <Terminal className="w-3.5 h-3.5" />
                  Connect
                </>
              )}
            </Button>

            <ToolbarDropdown label="Instance state" disabled={!hasSelection}>
              {(close) =>
                selectedIds.map((id) => {
                  const inst = filtered.find((i) => i.id === id)
                  if (!inst) return null
                  return (
                    <div key={id} className="py-0.5">
                      {selectedIds.length > 1 && (
                        <p className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                          {inst.name}
                        </p>
                      )}
                      {inst.status === "stopped" ? (
                        <MenuItem
                          onClick={() => {
                            handleAction(id, "start")
                            close()
                          }}
                        >
                          <Play className="w-3.5 h-3.5" /> Start
                        </MenuItem>
                      ) : (
                        <MenuItem
                          onClick={() => {
                            handleAction(id, "stop")
                            close()
                          }}
                        >
                          <Square className="w-3.5 h-3.5" /> Stop
                        </MenuItem>
                      )}
                      <MenuItem
                        onClick={() => {
                          handleAction(id, "restart")
                          close()
                        }}
                      >
                        <RotateCw className="w-3.5 h-3.5" /> Restart
                      </MenuItem>
                    </div>
                  )
                })
              }
            </ToolbarDropdown>

            <ToolbarDropdown label="Actions" disabled={!hasSelection}>
              {(close) =>
                selectedIds.map((id) => {
                  const inst = filtered.find((i) => i.id === id)
                  if (!inst) return null
                  const running = inst.status === "running"
                  return (
                    <div key={id} className="py-0.5">
                      {selectedIds.length > 1 && (
                        <p className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                          {inst.name}
                        </p>
                      )}
                      <MenuItem
                        href={running ? `/dashboard/instances/${id}/console` : undefined}
                        disabled={!running}
                      >
                        <Terminal className="w-3.5 h-3.5" /> Web terminal
                      </MenuItem>
                      <MenuItem
                        href={running ? `/dashboard/instances/${id}/monitoring` : undefined}
                        disabled={!running}
                      >
                        <Activity className="w-3.5 h-3.5" /> Monitoring
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          handleAction(id, "delete")
                          close()
                        }}
                        destructive
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Terminate
                      </MenuItem>
                    </div>
                  )
                })
              }
            </ToolbarDropdown>

            <Button size="sm" asChild>
              <Link href="/dashboard/instances/new">
                <Plus className="w-3.5 h-3.5" /> Launch instance
              </Link>
            </Button>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-lg border">
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search instances by name or ID"
                className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {loading ? (
            <TableRowsSkeleton rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Server className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No instances match your search" : "No instances yet"}
              </p>
              {!search && (
                <Button size="sm" asChild>
                  <Link href="/dashboard/instances/new">Launch instance</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden divide-y">
                {filtered.map((instance) => {
                  const isSelected = selected.has(instance.id)
                  const instanceId = formatInstanceId(instance.id)
                  return (
                    <div
                      key={instance.id}
                      onClick={() => toggleSelect(instance.id)}
                      className={`p-4 space-y-2 cursor-pointer transition-colors ${
                        isSelected ? "bg-accent/50" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(instance.id)}
                            className="rounded mt-1"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/instances/${instance.id}`}
                              className="font-medium hover:underline block truncate"
                            >
                              {instance.name}
                            </Link>
                            <p className="font-mono text-xs text-primary truncate">{instanceId}</p>
                          </div>
                        </div>
                        <StatusCell status={instance.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-6">
                        <span>{instance.memoryLimit}MB / {instance.cpuLimit}vCPU</span>
                        {instance.internalPort && <span>Port {instance.internalPort}</span>}
                        <span>{new Date(instance.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
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
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Instance ID</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">State</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Type</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Public address</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Port</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Launched</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((instance) => {
                    const isSelected = selected.has(instance.id)
                    const instanceId = formatInstanceId(instance.id)
                    return (
                      <tr
                        key={instance.id}
                        onClick={() => toggleSelect(instance.id)}
                        className={`border-b last:border-0 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-accent/50 ring-1 ring-inset ring-ring/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(instance.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-4">
                          <Link
                            href={`/dashboard/instances/${instance.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium hover:underline"
                          >
                            {instance.name}
                          </Link>
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/dashboard/instances/${instance.id}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {instanceId}
                            </Link>
                            <button
                              type="button"
                              onClick={() => copyId(instance.id)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy instance ID"
                            >
                              {copiedId === instance.id ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusCell status={instance.status} />
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">
                          {instance.memoryLimit}MB / {instance.cpuLimit}vCPU
                        </td>
                        <td className="p-4 font-mono text-xs">
                          {instance.appUrl && instance.status === "running" ? (
                            <a
                              href={instance.appUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:underline text-primary"
                            >
                              {instance.routingMode === "tunnel"
                                ? instance.suggestedDomain || instance.appUrl.replace(/^https?:\/\//, "")
                                : instance.appUrl.replace(/^https?:\/\//, "")}
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>

        {/* Bottom details panel */}
        {selectedInstance && (
          <div className="rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-medium">
                <span className="font-mono text-primary">{formatInstanceId(selectedInstance.id)}</span>
                <span className="text-muted-foreground"> ({selectedInstance.name})</span>
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link href={`/dashboard/instances/${selectedInstance.id}`}>View details</Link>
              </Button>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Instance summary
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                <div className="space-y-1">
                  <dt className="text-xs font-medium">Instance ID</dt>
                  <dd className="font-mono text-xs text-primary">{formatInstanceId(selectedInstance.id)}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium">State</dt>
                  <dd>
                    <StatusCell status={selectedInstance.status} />
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium">Resources</dt>
                  <dd className="text-sm text-primary">
                    {selectedInstance.memoryLimit}MB / {selectedInstance.cpuLimit}vCPU
                  </dd>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-xs font-medium">
                    {selectedInstance.routingMode === "tunnel" ? "URL" : "Access"}
                  </dt>
                  <dd className="text-sm font-mono text-primary">
                    {selectedInstance.status === "running" && selectedInstance.appUrl
                      ? selectedInstance.appUrl
                      : "—"}
                  </dd>
                </div>
                {selectedInstance.domains.length > 0 && (
                  <div className="space-y-1">
                    <dt className="text-xs font-medium">Custom domains</dt>
                    <dd className="text-sm text-muted-foreground">
                      {selectedInstance.domains.map((d) => d.domain).join(", ")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
