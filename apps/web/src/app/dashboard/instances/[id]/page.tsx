"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { toast } from "@/hooks/use-toast"
import type { InstanceNetworking } from "@/lib/instance"
import {
  Play,
  Square,
  RotateCw,
  Terminal,
  Activity,
  Globe,
  Trash2,
  HardDrive,
  Copy,
  Check,
  Key,
  Server,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
import { DetailPageSkeleton } from "@/components/skeletons/page-skeletons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        toast({ title: "Copied", description: "Value copied to clipboard." })
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  )
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-3 py-2">
        <code className="flex-1 text-xs font-mono break-all">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "muted" | "destructive" | "secondary" }> = {
    running: { label: "Running", variant: "success" },
    stopped: { label: "Stopped", variant: "muted" },
    creating: { label: "Creating", variant: "secondary" },
    error: { label: "Error", variant: "destructive" },
  }
  const cfg = map[status] ?? { label: status, variant: "muted" as const }
  return (
    <Badge variant={cfg.variant} className="gap-1.5 capitalize">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "running"
            ? "bg-emerald-500"
            : status === "error"
              ? "bg-destructive"
              : "bg-muted-foreground"
        }`}
      />
      {cfg.label}
    </Badge>
  )
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  )
}

export default function InstanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = searchParams.get("new") === "1"
  const newKeyName = searchParams.get("key")
  const [instance, setInstance] = useState<InstanceNetworking | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
    fetchInstance()
  }, [params.id])

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
        title: action === "start" ? "Instance started" : action === "stop" ? "Instance stopped" : "Instance restarted",
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
  const isLocal = instance.publicHost === "localhost"

  const publicUrl =
    isTunnel && instance.suggestedDomain
      ? instance.appUrl || `https://${instance.suggestedDomain}`
      : instance.appUrl

  const localPorts = [
    { name: "Application", host: instance.internalPort, container: 3000 },
    ...(isNginx ? [{ name: "HTTP (Nginx)", host: instance.httpPort, container: 80 }] : []),
    { name: "SSH", host: instance.sshPort, container: 22 },
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

      <PageShell maxWidth="6xl">
        <Button variant="ghost" asChild className="-ml-2 h-9 text-muted-foreground">
          <Link href="/dashboard/instances">
            <ArrowLeft className="w-3.5 h-3.5" /> All instances
          </Link>
        </Button>

        <PageHeader
          title={instance.name}
          description={instance.id}
          actions={
          <div className="flex flex-wrap gap-2">
            {instance.status === "stopped" || isError ? (
              <Button
                variant="outline"
                className="h-9"
                disabled={!!actionLoading || isError}
                onClick={() => handleAction("start")}
              >
                {actionLoading === "start" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Start
              </Button>
            ) : (
              <Button variant="outline" className="h-9" disabled={!!actionLoading} onClick={() => handleAction("stop")}>
                {actionLoading === "stop" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                Stop
              </Button>
            )}
            <Button variant="outline" className="h-9" disabled={!!actionLoading || isError} onClick={() => handleAction("restart")}>
              {actionLoading === "restart" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              Restart
            </Button>
            <Button className="h-9" asChild disabled={!isRunning}>
              <Link href={`/dashboard/instances/${instance.id}/console`}>
                <Terminal className="w-3.5 h-3.5" /> Connect
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={!!actionLoading}
              onClick={() => setConfirmDelete(true)}
            >
              {actionLoading === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Terminate
            </Button>
          </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={instance.status} />
          <Badge variant="outline">{instance.memoryLimit} MB</Badge>
          <Badge variant="outline">{instance.cpuLimit} vCPU</Badge>
          {instance.sshKeyName && <Badge variant="outline">SSH: {instance.sshKeyName}</Badge>}
          {instance.suggestedDomain && instance.routingMode === "tunnel" && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {instance.suggestedDomain}
            </Badge>
          )}
        </div>

        {isNew && (publicUrl || instance.sshCommand) && (
          <Alert className="border-emerald-500/30 bg-emerald-500/5">
            <Check className="w-4 h-4 text-emerald-600" />
            <AlertTitle>Instance created</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              {publicUrl && <CopyBlock label={isTunnel ? "Public URL" : "App URL"} value={publicUrl} />}
              {!isTunnel && instance.sshCommand && (
                <CopyBlock label="SSH command" value={instance.sshCommand} />
              )}
              {newKeyName && !isTunnel && (
                <p className="text-xs">
                  Move <code className="font-mono">~/.ssh/{newKeyName}.pem</code> and run{" "}
                  <code className="font-mono">chmod 400 ~/.ssh/{newKeyName}.pem</code>
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Failed to create container</AlertTitle>
            <AlertDescription>
              The Docker image may be missing locally. Run <code className="font-mono">npm run docker:base</code>, then
              terminate this instance and launch a new one.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Access */}
            <Card className="rounded-2xl border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  {isTunnel ? "Public access" : "Access"}
                </CardTitle>
                <CardDescription>
                  {isTunnel
                    ? "Routed through Cloudflare Tunnel — no ports in the URL."
                    : isLocal
                      ? "Local development — use localhost ports or the web terminal."
                      : "Direct access via host ports."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isRunning && publicUrl ? (
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <CopyBlock label={isTunnel ? "URL" : "App URL"} value={publicUrl} />
                    </div>
                    <Button variant="outline" className="h-9 shrink-0" asChild>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                        Open <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isRunning ? "No URL available." : "Start the instance to get the URL."}
                  </p>
                )}

                {isTunnel && instance.baseDomain && (
                  <p className="text-xs text-muted-foreground">
                    Subdomain auto:{" "}
                    <code className="font-mono">
                      {instance.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}.{instance.baseDomain}
                    </code>
                    {" — "}add custom domains in{" "}
                    <Link href="/dashboard/domains" className="underline">
                      Domains
                    </Link>
                    .
                  </p>
                )}

                {!isTunnel && isRunning && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Port mappings</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service</TableHead>
                            <TableHead>Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {localPorts.map((p) => (
                            <TableRow key={p.name}>
                              <TableCell className="font-medium text-sm">{p.name}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {p.host ? `${instance.publicHost}:${p.host}` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {isRunning && (
                  <Button className="h-9" asChild>
                    <Link href={`/dashboard/instances/${instance.id}/console`}>
                      <Terminal className="w-3.5 h-3.5" /> Web terminal
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* SSH — local / port mode only */}
            {!isTunnel && (
              <Card className="rounded-2xl border-border shadow-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      SSH
                    </CardTitle>
                    <CardDescription>Optional — web terminal is usually enough.</CardDescription>
                  </div>
                  <Button variant="link" className="h-9 px-0" asChild>
                    <Link href="/dashboard/ssh-keys">Manage keys</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {instance.sshCommand && isRunning ? (
                    <div className="space-y-3">
                      <CopyBlock label="Command" value={instance.sshCommand} />
                      {instance.sshKeyName ? (
                        <p className="text-xs text-muted-foreground">
                          Key: <code className="font-mono">~/.ssh/{instance.sshKeyName}.pem</code>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No key linked.{" "}
                          <Link href="/dashboard/ssh-keys" className="underline">
                            Create one
                          </Link>{" "}
                          for new instances.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isRunning ? "No SSH key on this instance." : "Start the instance to see the SSH command."}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Technical details — collapsed/minimal */}
            <Card className="rounded-2xl border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <DetailItem label="Container ID" value={instance.containerId?.slice(0, 12) || "—"} mono />
                  <DetailItem label="Created" value={new Date(instance.createdAt).toLocaleString()} />
                  {!isTunnel && instance.privateIp && (
                    <DetailItem label="Internal IP" value={instance.privateIp} mono />
                  )}
                  {isTunnel && (
                    <DetailItem label="Routing" value="Cloudflare Tunnel" />
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {[
              {
                href: `/dashboard/instances/${instance.id}/console`,
                icon: Terminal,
                label: "Web terminal",
                desc: "Browser console, no SSH needed",
                disabled: !isRunning,
              },
              {
                href: `/dashboard/instances/${instance.id}/monitoring`,
                icon: Activity,
                label: "Monitoring",
                desc: "CPU, memory & network",
                disabled: !isRunning,
              },
              {
                href: `/dashboard/backups?instance=${instance.id}`,
                icon: HardDrive,
                label: "Snapshots",
                desc: "Backup & restore",
                disabled: false,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={item.disabled ? "pointer-events-none opacity-50" : ""}
              >
                <Card className="rounded-2xl border-border shadow-none hover:bg-muted/40 transition-colors">
                  <CardContent className="pt-4 flex items-start gap-3">
                    <div className="p-2 rounded-lg border bg-background">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {instance.domains.length > 0 && (
          <Card className="rounded-2xl border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Custom domains
              </CardTitle>
              <CardDescription>
                {isTunnel ? "Routed via Cloudflare Tunnel — HTTPS included." : "DNS configuration required."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>SSL</TableHead>
                    {!isTunnel && <TableHead>DNS</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instance.domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">
                        <a
                          href={`https://${d.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {d.domain}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.sslEnabled ? "success" : "muted"}>
                          {d.sslEnabled ? "Active" : "Off"}
                        </Badge>
                      </TableCell>
                      {!isTunnel && (
                        <TableCell className="text-xs text-muted-foreground">
                          A → {instance.publicHost !== "localhost" ? instance.publicHost : "your server IP"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
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
          handleAction("delete")
        }}
      />
    </>
  )
}
