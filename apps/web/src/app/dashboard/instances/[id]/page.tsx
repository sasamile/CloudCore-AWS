"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
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
  Rocket,
  ExternalLink,
  HardDrive,
  Copy,
  Check,
  Key,
  Server,
  Network,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
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
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ url: string; message: string } | null>(null)

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
        <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading instance...
        </div>
      </>
    )
  }
  if (!instance) return null

  const isRunning = instance.status === "running"
  const isError = instance.status === "error"
  const publicIp = instance.publicHost !== "localhost" ? instance.publicHost : null

  const ports = [
    { name: "App (Node.js)", host: instance.internalPort, container: 3000 },
    { name: "HTTP (Nginx)", host: instance.httpPort, container: 80 },
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

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/dashboard/instances">
            <ArrowLeft className="w-3.5 h-3.5" /> All instances
          </Link>
        </Button>

        {/* Hero */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{instance.name}</h2>
              <StatusBadge status={instance.status} />
            </div>
            <p className="text-sm text-muted-foreground font-mono">{instance.id}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">{instance.memoryLimit} MB</Badge>
              <Badge variant="outline">{instance.cpuLimit} vCPU</Badge>
              {instance.sshKeyName && <Badge variant="outline">SSH: {instance.sshKeyName}</Badge>}
              {instance.suggestedDomain && instance.routingMode === "tunnel" && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {instance.suggestedDomain}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {instance.status === "stopped" || isError ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!!actionLoading || isError}
                onClick={() => handleAction("start")}
              >
                {actionLoading === "start" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Start
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={!!actionLoading} onClick={() => handleAction("stop")}>
                {actionLoading === "stop" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                Stop
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!!actionLoading || isError} onClick={() => handleAction("restart")}>
              {actionLoading === "restart" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              Restart
            </Button>
            <Button size="sm" asChild disabled={!isRunning}>
              <Link href={`/dashboard/instances/${instance.id}/console`}>
                <Terminal className="w-3.5 h-3.5" /> Connect
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={!!actionLoading}
              onClick={() => setConfirmDelete(true)}
            >
              {actionLoading === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Terminate
            </Button>
          </div>
        </div>

        {isNew && instance.sshCommand && (
          <Alert className="border-emerald-500/30 bg-emerald-500/5">
            <Check className="w-4 h-4 text-emerald-600" />
            <AlertTitle>Instance created</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <CopyBlock label="SSH command" value={instance.sshCommand} />
              {newKeyName && (
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
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  Instance details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <DetailItem label="Private IPv4" value={instance.privateIp || "—"} mono={!!instance.privateIp} />
                  <DetailItem
                    label="Public IPv4"
                    value={publicIp || "Not configured"}
                    mono={!!publicIp}
                  />
                  <DetailItem
                    label="Public DNS"
                    value={instance.domains.length > 0 ? instance.domains.map((d) => d.domain).join(", ") : "—"}
                  />
                  <DetailItem label="Container ID" value={instance.containerId?.slice(0, 12) || "—"} mono />
                  <DetailItem label="Launched" value={new Date(instance.createdAt).toLocaleString()} />
                  <DetailItem label="Hostname" value={`${instance.id.slice(0, 12)}-${instance.name}`} mono />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="w-4 h-4 text-muted-foreground" />
                  Networking
                </CardTitle>
                <CardDescription>Port mappings from host to container.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!publicIp && instance.routingMode !== "tunnel" && (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Local development mode</AlertTitle>
                    <AlertDescription className="text-xs">
                      Set <code className="font-mono">PUBLIC_HOST</code> and{" "}
                      <code className="font-mono">NEXT_PUBLIC_PUBLIC_HOST</code> for public URLs.
                    </AlertDescription>
                  </Alert>
                )}

                {instance.routingMode === "tunnel" && instance.suggestedDomain && (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Cloudflare Tunnel</AlertTitle>
                    <AlertDescription className="text-xs space-y-2">
                      <p>
                        Public URL (no port):{" "}
                        <code className="font-mono">https://{instance.suggestedDomain}</code>
                      </p>
                      <p>
                        ZynCloud registers the tunnel route and DNS automatically when the instance
                        starts. Each instance name becomes a subdomain under{" "}
                        <code className="font-mono">{instance.baseDomain || "BASE_DOMAIN"}</code>{" "}
                        (e.g. <code className="font-mono">tienda.{instance.baseDomain || "example.com"}</code>).
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead className="text-right">Container</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ports.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.host ? `${instance.publicHost}:${p.host}` : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-muted-foreground">
                          :{p.container}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {(instance.appUrl || instance.httpUrl) && isRunning && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {instance.appUrl && <CopyBlock label="App URL" value={instance.appUrl} />}
                      {instance.httpUrl && <CopyBlock label="HTTP URL" value={instance.httpUrl} />}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    SSH access
                  </CardTitle>
                </div>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href="/dashboard/ssh-keys">Manage keys</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {instance.sshCommand && isRunning ? (
                  <div className="space-y-3">
                    <CopyBlock label="Connect command" value={instance.sshCommand} />
                    {instance.sshKeyName ? (
                      <p className="text-xs text-muted-foreground">
                        Use <code className="font-mono">~/.ssh/{instance.sshKeyName}.pem</code>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No key pair linked.{" "}
                        <Link href="/dashboard/ssh-keys" className="underline">
                          Create one
                        </Link>{" "}
                        for new instances.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isRunning
                      ? "No SSH key on this instance."
                      : "Start the instance to see the SSH command."}
                  </p>
                )}
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
                <Card className="hover:bg-muted/40 transition-colors">
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Rocket className="w-4 h-4" />
                  Quick deploy
                </CardTitle>
                <CardDescription className="text-xs">
                  Deploy a test Node.js app on port 3000.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={deploying || !isRunning}
                  onClick={async () => {
                    setDeploying(true)
                    try {
                      const result = await api.post<{ url: string; message: string }>(
                        `/instances/${instance.id}/deploy-test`
                      )
                      setDeployResult(result)
                      toast({ title: "Deploy complete", description: result.message })
                    } catch (err) {
                      toast({
                        title: "Deploy failed",
                        description: formatApiError(err instanceof Error ? err.message : undefined),
                        variant: "destructive",
                      })
                    } finally {
                      setDeploying(false)
                    }
                  }}
                >
                  {deploying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5" /> Deploy test app
                    </>
                  )}
                </Button>
                {deployResult && (
                  <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                    <p className="text-xs font-medium">{deployResult.message}</p>
                    <a
                      href={deployResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-mono hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> {deployResult.url}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {instance.domains.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Domains
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead>DNS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instance.domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                      <TableCell>
                        <Badge variant={d.sslEnabled ? "success" : "muted"}>
                          {d.sslEnabled ? "Active" : "Off"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        A → {publicIp || "your public IP"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

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
