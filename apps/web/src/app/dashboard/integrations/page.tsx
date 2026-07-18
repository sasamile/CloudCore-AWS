"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Github,
  Loader2,
  Rocket,
  Unplug,
  RefreshCw,
  GitBranch,
  Plus,
  Play,
  ScrollText,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface Integration {
  id: string
  provider: string
  username: string | null
  email: string | null
}

interface Repo {
  id: number
  fullName: string
  defaultBranch: string
  private: boolean
}

interface Instance {
  id: string
  name: string
  status: string
}

interface Deployment {
  id: string
  repoFullName: string
  branch: string
  rootDir: string
  buildCommand: string | null
  startCommand: string | null
  status: string
  lastLog: string | null
  updatedAt: string
  instance: { id: string; name: string }
}

const STATUS_CFG = {
  success: { label: "Listo", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", spin: false },
  deploying: { label: "Desplegando", icon: Loader2, color: "text-blue-600 dark:text-blue-400", spin: true },
  building: { label: "Build", icon: Loader2, color: "text-blue-600 dark:text-blue-400", spin: true },
  error: { label: "Error", icon: XCircle, color: "text-destructive", spin: false },
  idle: { label: "Sin desplegar", icon: Clock, color: "text-muted-foreground", spin: false },
} as const

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.idle
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
      <Icon className={cn("size-3.5 shrink-0", cfg.spin && "animate-spin")} />
      {cfg.label}
    </span>
  )
}

function ProjectCard({ dep, onDeploy, onLogs }: {
  dep: Deployment
  onDeploy: (id: string) => void
  onLogs: (dep: Deployment) => void
}) {
  const timeAgo = formatDistanceToNow(new Date(dep.updatedAt), { addSuffix: true, locale: es })
  const repoName = dep.repoFullName.split("/")[1] ?? dep.repoFullName
  const busy = dep.status === "deploying" || dep.status === "building"

  return (
    <div className="rounded-2xl border border-border bg-card hover:border-border/80 transition-colors overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Github className="size-4 shrink-0 text-muted-foreground" />
            <p className="font-semibold text-sm">{repoName}</p>
            <StatusBadge status={dep.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="size-3" />
              <span className="font-mono">{dep.branch}</span>
            </span>
            <span>→ {dep.instance.name}</span>
            <span className="hidden sm:inline text-muted-foreground/50">{dep.repoFullName}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/60">{timeAgo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {dep.lastLog && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => onLogs(dep)} title="Ver logs">
              <ScrollText className="size-3.5" />
            </Button>
          )}
          <Button size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={() => onDeploy(dep.id)} disabled={busy}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
            {busy ? "Desplegando..." : "Desplegar"}
          </Button>
        </div>
      </div>
      <div className="border-t border-border/50 bg-muted/20 px-5 py-2.5 flex items-center gap-2">
        <Zap className="size-3 text-muted-foreground shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Auto-deploy activo — cada push a{" "}
          <span className="font-mono font-medium text-foreground">{dep.branch}</span>{" "}
          despliega automáticamente
        </p>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsContent />
    </Suspense>
  )
}

function IntegrationsContent() {
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [repos, setRepos] = useState<Repo[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [logsDialog, setLogsDialog] = useState<Deployment | null>(null)

  const [form, setForm] = useState({
    repoFullName: "",
    instanceId: "",
    branch: "main",
    buildCommand: "npm ci && npm run build",
    startCommand: "nohup npm start > /tmp/app.log 2>&1 &",
    rootDir: ".",
  })

  const github = integrations.find((i) => i.provider === "github")

  async function load() {
    try {
      const [ints, insts, deps] = await Promise.all([
        api.get<Integration[]>("/integrations"),
        api.get<Instance[]>("/instances").catch(() => [] as Instance[]),
        api.get<Deployment[]>("/deployments"),
      ])
      setIntegrations(ints)
      setInstances(insts)
      setDeployments(deps)

      if (ints.some((i) => i.provider === "github")) {
        const repoList = await api.get<Repo[]>("/integrations/github/repos").catch(() => [] as Repo[])
        setRepos(repoList)
        if (repoList[0] && !form.repoFullName) {
          setForm((f) => ({ ...f, repoFullName: repoList[0].fullName, branch: repoList[0].defaultBranch }))
        }
      }

      if (insts[0] && !form.instanceId) {
        setForm((f) => ({ ...f, instanceId: insts[0].id }))
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const gh = searchParams.get("github")
    if (gh === "connected") toast({ title: "GitHub conectado exitosamente" })
    if (gh === "error") toast({ title: "Error al conectar GitHub", variant: "destructive" })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function connectGithub() {
    setConnecting(true)
    try {
      const { url } = await api.get<{ url: string }>("/integrations/github/authorize")
      window.location.href = url
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
      setConnecting(false)
    }
  }

  async function disconnectGithub() {
    await api.delete("/integrations/account/github")
    setRepos([])
    load()
    toast({ title: "GitHub desconectado" })
  }

  async function handleImport() {
    if (!form.repoFullName || !form.instanceId) {
      toast({ title: "Faltan datos", description: "Elige repositorio e instancia", variant: "destructive" })
      return
    }
    setImporting(true)
    try {
      const created = await api.post<Deployment>("/deployments", {
        repoFullName: form.repoFullName,
        instanceId: form.instanceId,
        branch: form.branch,
        buildCommand: form.buildCommand,
        startCommand: form.startCommand,
        rootDir: form.rootDir,
      })
      setShowImport(false)
      toast({ title: "Proyecto importado", description: "Lanzando primer deploy..." })
      // Dispara el primer deploy inmediatamente
      await api.post(`/deployments/${created.id}/trigger`).catch(() => {})
      await load()
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  async function handleDeploy(id: string) {
    try {
      await api.post(`/deployments/${id}/trigger`)
      toast({ title: "Despliegue iniciado" })
      setTimeout(load, 1500)
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    }
  }

  return (
    <>
      <Header title="Deployments" breadcrumbs={[{ label: "Compute", href: "/dashboard/instances" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Deployments"
          description="Conecta GitHub y cada push despliega automáticamente en tu instancia."
          actions={
            github && instances.length > 0 ? (
              <Button className="h-9 gap-1.5" onClick={() => setShowImport(true)}>
                <Plus className="size-3.5" /> Importar proyecto
              </Button>
            ) : undefined
          }
        />

        {/* GitHub connection card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
            <Github className="size-3.5 text-muted-foreground" />
            <p className="text-sm font-medium">GitHub</p>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            {github ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Conectado
                </span>
                <span className="text-sm font-medium">@{github.username}</span>
                {github.email && <span className="text-xs text-muted-foreground">{github.email}</span>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Conecta tu cuenta para importar repositorios.</p>
            )}
            <div className="flex gap-2 shrink-0">
              {github ? (
                <>
                  <Button variant="outline" size="icon" className="size-9" onClick={load} title="Actualizar">
                    <RefreshCw className="size-3.5" />
                  </Button>
                  <Button variant="outline" className="h-9" onClick={disconnectGithub}>
                    <Unplug className="size-3.5" /> Desconectar
                  </Button>
                </>
              ) : (
                <Button className="h-9" onClick={connectGithub} disabled={connecting}>
                  {connecting ? <Loader2 className="size-3.5 animate-spin" /> : <Github className="size-3.5" />}
                  Conectar GitHub
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* No instances warning */}
        {github && instances.length === 0 && !loading && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
            Necesitas al menos una instancia corriendo para desplegar.{" "}
            <a href="/dashboard/instances/new" className="underline text-foreground">Crear instancia →</a>
          </div>
        )}

        {/* Projects */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : !github ? null : deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
              <Rocket className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Sin proyectos importados</p>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground leading-relaxed">
              Importa un repositorio para que cada push a GitHub lo despliegue automáticamente.
            </p>
            {instances.length > 0 && (
              <Button className="mt-5 h-9 gap-1.5" onClick={() => setShowImport(true)}>
                <Plus className="size-3.5" /> Importar proyecto
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {deployments.map((d) => (
              <ProjectCard key={d.id} dep={d} onDeploy={handleDeploy} onLogs={setLogsDialog} />
            ))}
          </div>
        )}
      </PageShell>

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={(o) => !o && setShowImport(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar proyecto</DialogTitle>
            <DialogDescription>
              Configura el repo y la instancia una sola vez. Cada push a la rama de producción se despliega automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Repositorio</label>
              <select
                value={form.repoFullName}
                onChange={(e) => {
                  const repo = repos.find((r) => r.fullName === e.target.value)
                  setForm((f) => ({ ...f, repoFullName: e.target.value, branch: repo?.defaultBranch ?? "main" }))
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Seleccionar repositorio...</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.fullName}>{r.fullName}{r.private ? " (privado)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Instancia destino</label>
              <select
                value={form.instanceId}
                onChange={(e) => setForm((f) => ({ ...f, instanceId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Seleccionar instancia...</option>
                {instances.filter((i) => i.status === "running").map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Rama de producción</label>
                <Input value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Directorio raíz</label>
                <Input value={form.rootDir} onChange={(e) => setForm((f) => ({ ...f, rootDir: e.target.value }))} className="h-9 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Build command</label>
              <Input value={form.buildCommand} onChange={(e) => setForm((f) => ({ ...f, buildCommand: e.target.value }))} className="h-9 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start command</label>
              <Input value={form.startCommand} onChange={(e) => setForm((f) => ({ ...f, startCommand: e.target.value }))} className="h-9 font-mono text-xs" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button className="h-9 gap-1.5" onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
              Importar y desplegar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs dialog */}
      <Dialog open={!!logsDialog} onOpenChange={(o) => !o && setLogsDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{logsDialog?.repoFullName}</DialogTitle>
            <DialogDescription>Salida del último despliegue · rama {logsDialog?.branch}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-auto rounded-xl border border-border bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">
            {logsDialog?.lastLog || "Sin logs aún."}
          </pre>
          <DialogFooter>
            <Button className="h-9" onClick={() => setLogsDialog(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
