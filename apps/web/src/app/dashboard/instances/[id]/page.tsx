"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Activity,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  HardDrive,
  Key,
  Loader2,
  Play,
  RotateCw,
  Square,
  Terminal,
  Trash2,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { CopyField } from "@/components/instances/copy-field"
import { StatusBadge } from "@/components/instances/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DetailPageSkeleton } from "@/components/skeletons/page-skeletons"
import { toast } from "@/hooks/use-toast"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import type { InstanceNetworking } from "@/lib/instance"
import { cn } from "@/lib/utils"

function formatCreated(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatRam(mb: number) {
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`
  }
  return `${mb} MB`
}

export default function InstanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = searchParams.get("new") === "1"
  const [newKeyHint] = useState(() => searchParams.get("key"))

  const [instance, setInstance] = useState<InstanceNetworking | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [welcomed, setWelcomed] = useState(false)

  async function fetchInstance() {
    try {
      const data = await api.get<InstanceNetworking>(`/instances/${params.id}`)
      setInstance(data)
    } catch {
      router.push("/dashboard/instances")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchInstance()
  }, [params.id])

  useEffect(() => {
    if (!isNew || !instance || welcomed) return
    setWelcomed(true)
    toast({
      title: "Instance ready",
      description: instance.name,
    })
    router.replace(`/dashboard/instances/${instance.id}`, { scroll: false })
  }, [isNew, instance, router, welcomed])

  async function handleAction(action: "start" | "stop" | "restart" | "delete") {
    if (!instance) return

    setActionLoading(action)
    try {
      if (action === "delete") {
        await api.delete(`/instances/${instance.id}`)
        toast({ title: "Instance terminated", description: `${instance.name} was deleted.` })
        router.push("/dashboard/instances")
        return
      }
      await api.post(`/instances/${instance.id}/${action}`)
      toast({
        title:
          action === "start"
            ? "Instance started"
            : action === "stop"
              ? "Instance stopped"
              : "Instance restarted",
      })
      await fetchInstance()
    } catch (err) {
      toast({
        title: "Action failed",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Instance" breadcrumbs={[{ label: "Instances", href: "/dashboard/instances" }]} />
        <PageShell>
          <DetailPageSkeleton />
        </PageShell>
      </>
    )
  }

  if (!instance) return null

  const isRunning = instance.status === "running"
  const isError = instance.status === "error"
  const isTunnel = instance.routingMode === "tunnel"
  const isNginx = instance.routingMode === "nginx"
  const busy = !!actionLoading

  const publicUrl =
    isTunnel && instance.suggestedDomain
      ? instance.appUrl || `https://${instance.suggestedDomain}`
      : instance.appUrl

  const ports = [
    { name: "App", host: instance.internalPort },
    ...(isNginx ? [{ name: "HTTP", host: instance.httpPort }] : []),
    { name: "SSH", host: instance.sshPort },
  ].filter((p) => p.host)

  const tools = [
    {
      href: `/dashboard/instances/${instance.id}/console`,
      icon: Terminal,
      label: "Console",
      desc: "Web terminal",
      disabled: !isRunning,
    },
    {
      href: `/dashboard/instances/${instance.id}/monitoring`,
      icon: Activity,
      label: "Monitoring",
      desc: "CPU & memory",
      disabled: !isRunning,
    },
    {
      href: `/dashboard/backups?instance=${instance.id}`,
      icon: HardDrive,
      label: "Snapshots",
      desc: "Backup & restore",
      disabled: false,
    },
  ]

  return (
    <>
      <Header
        title={instance.name}
        breadcrumbs={[
          { label: "Instances", href: "/dashboard/instances" },
          { label: instance.name },
        ]}
      />

      <PageShell>
        <PageHeader
          title={instance.name}
          description={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge status={instance.status} />
              <span className="text-muted-foreground">·</span>
              <span>
                {formatRam(instance.memoryLimit)} · {instance.cpuLimit} vCPU
              </span>
              <span className="text-muted-foreground">·</span>
              <span>Created {formatCreated(instance.createdAt)}</span>
              {instance.sshKeyName ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    {instance.sshKeyName}
                  </span>
                </>
              ) : null}
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {instance.status === "stopped" || isError ? (
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={busy || isError}
                  onClick={() => handleAction("start")}
                >
                  {actionLoading === "start" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Start
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={busy}
                  onClick={() => handleAction("stop")}
                >
                  {actionLoading === "stop" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Stop
                </Button>
              )}
              <Button
                variant="outline"
                className="h-9"
                disabled={busy || isError}
                onClick={() => handleAction("restart")}
              >
                {actionLoading === "restart" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                Restart
              </Button>
              <Button className="h-9" asChild disabled={!isRunning}>
                <Link href={`/dashboard/instances/${instance.id}/console`}>
                  <Terminal className="h-3.5 w-3.5" />
                  Connect
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="h-9 text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                {actionLoading === "delete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Terminate
              </Button>
            </div>
          }
        />

        {isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to create container</AlertTitle>
            <AlertDescription>
              The Docker image may be missing. Run{" "}
              <code className="font-mono text-xs">npm run docker:base</code>, then terminate this
              instance and launch a new one.
            </AlertDescription>
          </Alert>
        ) : null}

        {newKeyHint && !isTunnel ? (
          <Alert>
            <Key className="h-4 w-4" />
            <AlertTitle>SSH key created</AlertTitle>
            <AlertDescription className="text-sm">
              Save{" "}
              <code className="font-mono text-xs">~/.ssh/{newKeyHint}.pem</code> and run{" "}
              <code className="font-mono text-xs">chmod 400 ~/.ssh/{newKeyHint}.pem</code>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="rounded-2xl border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Access</CardTitle>
                <CardDescription>
                  {isTunnel
                    ? "Public URL via Cloudflare Tunnel"
                    : "Reach this instance on the host"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isRunning && publicUrl ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <CopyField className="min-w-0 flex-1" value={publicUrl} />
                    <Button variant="outline" className="h-9 shrink-0" asChild>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                        Open
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isRunning ? "No public URL yet." : "Start the instance to get a URL."}
                  </p>
                )}

                {!isTunnel && isRunning && ports.length > 0 ? (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {ports.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="text-muted-foreground">{p.name}</span>
                        <code className="font-mono text-xs">
                          {instance.publicHost}:{p.host}
                        </code>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {isTunnel ? (
                  <p className="text-xs text-muted-foreground">
                    Add custom hostnames in{" "}
                    <Link href="/dashboard/domains" className="underline underline-offset-2">
                      Domains
                    </Link>
                    .
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {!isTunnel ? (
              <Card className="rounded-2xl border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">SSH</CardTitle>
                      <CardDescription>Optional — Console usually covers this.</CardDescription>
                    </div>
                    <Button variant="link" className="h-auto px-0 text-sm" asChild>
                      <Link href="/dashboard/ssh-keys">Keys</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {instance.sshCommand && isRunning ? (
                    <CopyField value={instance.sshCommand} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isRunning
                        ? "No SSH key linked to this instance."
                        : "Start the instance to see the SSH command."}
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {instance.domains.length > 0 ? (
              <Card className="rounded-2xl border-border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Custom domains</CardTitle>
                  <CardDescription>
                    {isTunnel ? "HTTPS via Cloudflare Tunnel" : "Point DNS at your host"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {instance.domains.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 px-6 py-3"
                      >
                        <a
                          href={`https://${d.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-mono text-xs hover:underline"
                        >
                          {d.domain}
                        </a>
                        <span
                          className={cn(
                            "text-xs",
                            d.sslEnabled ? "text-emerald-600" : "text-muted-foreground",
                          )}
                        >
                          {d.sslEnabled ? "SSL on" : "SSL off"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-6">
            <Card className="rounded-2xl border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tools</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {tools.map((item) => {
                    const content = (
                      <span className="flex items-center gap-3 px-4 py-3">
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.desc}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </span>
                    )

                    if (item.disabled) {
                      return (
                        <li key={item.href} className="opacity-40">
                          <span className="block cursor-not-allowed">{content}</span>
                        </li>
                      )
                    }

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block transition-colors hover:bg-muted/40"
                        >
                          {content}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-2 px-1 text-xs text-muted-foreground">
              {isTunnel ? <p>Routing · Cloudflare Tunnel</p> : null}
              {instance.containerId ? (
                <p className="font-mono">
                  Container · {instance.containerId.slice(0, 12)}
                </p>
              ) : null}
              {!isTunnel && instance.privateIp ? (
                <p className="font-mono">Internal · {instance.privateIp}</p>
              ) : null}
            </div>
          </aside>
        </div>
      </PageShell>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Terminate instance?"
        description={`${instance.name} and its container will be permanently deleted. This cannot be undone.`}
        confirmLabel="Terminate"
        destructive
        loading={actionLoading === "delete"}
        onConfirm={() => {
          setConfirmDelete(false)
          void handleAction("delete")
        }}
      />
    </>
  )
}
