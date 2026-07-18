"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
  Zap,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { StatusBadge } from "@/components/deployments/status-badge"
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

interface Deployment {
  id: string
  repoFullName: string
  branch: string
  rootDir: string
  framework: string | null
  port: number | null
  buildCommand: string | null
  startCommand: string | null
  status: string
  lastLog: string | null
  updatedAt: string
}

function ProjectCard({ dep, onDeploy, onOpen }: {
  dep: Deployment
  onDeploy: (id: string) => void
  onOpen: (id: string) => void
}) {
  const timeAgo = formatDistanceToNow(new Date(dep.updatedAt), { addSuffix: true, locale: es })
  const repoName = dep.repoFullName.split("/")[1] ?? dep.repoFullName
  const busy = dep.status === "deploying" || dep.status === "building"

  return (
    <div className="group rounded-2xl border border-border bg-card hover:border-border/80 transition-colors overflow-hidden">
      <button onClick={() => onOpen(dep.id)} className="w-full text-left p-5 flex items-start justify-between gap-4">
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
            {dep.framework && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                <Sparkles className="size-2.5" /> {dep.framework}
              </span>
            )}
            <span className="hidden sm:inline text-muted-foreground/50">{dep.repoFullName}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/60">Actualizado {timeAgo}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-0.5" />
      </button>
      <div className="border-t border-border/50 bg-muted/20 px-5 py-2.5 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Zap className="size-3 shrink-0" />
          Auto-deploy en <span className="font-mono font-medium text-foreground">{dep.branch}</span>
        </p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-full px-3 text-xs" onClick={() => onDeploy(dep.id)} disabled={busy}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          {busy ? "Desplegando" : "Redeploy"}
        </Button>
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
  const router = useRouter()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [repos, setRepos] = useState<Repo[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [detecting, setDetecting] = useState(false)

  const [form, setForm] = useState({
    repoFullName: "",
    branch: "main",
    rootDir: ".",
    framework: "",
    buildCommand: "",
    startCommand: "",
  })

  const github = integrations.find((i) => i.provider === "github")

  async function load() {
    try {
      const [ints, deps] = await Promise.all([
        api.get<Integration[]>("/integrations"),
        api.get<Deployment[]>("/deployments"),
      ])
      setIntegrations(ints)
      setDeployments(deps)

      if (ints.some((i) => i.provider === "github")) {
        const repoList = await api.get<Repo[]>("/integrations/github/repos").catch(() => [] as Repo[])
        setRepos(repoList)
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

  // Auto-refresca mientras haya despliegues en progreso.
  useEffect(() => {
    const active = deployments.some((d) => d.status === "deploying" || d.status === "building")
    if (!active) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployments])

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

  function openImport() {
    setForm({ repoFullName: "", branch: "main", rootDir: ".", framework: "", buildCommand: "", startCommand: "" })
    setShowImport(true)
  }

  // Al elegir repo, detecta framework y pre-llena comandos (cero-config, como Vercel).
  async function onSelectRepo(fullName: string) {
    const repo = repos.find((r) => r.fullName === fullName)
    const branch = repo?.defaultBranch ?? "main"
    setForm((f) => ({ ...f, repoFullName: fullName, branch }))
    if (!fullName) return
    setDetecting(true)
    try {
      const detected = await api.get<{ framework: string; buildCommand: string; startCommand: string }>(
        `/deployments/detect?repoFullName=${encodeURIComponent(fullName)}&branch=${encodeURIComponent(branch)}&rootDir=.`,
      )
      setForm((f) => ({
        ...f,
        framework: detected.framework,
        buildCommand: detected.buildCommand,
        startCommand: detected.startCommand,
      }))
    } catch {
      setForm((f) => ({ ...f, framework: "", buildCommand: "npm install && npm run build", startCommand: "npm run start" }))
    } finally {
      setDetecting(false)
    }
  }

  async function handleImport() {
    if (!form.repoFullName) {
      toast({ title: "Elige un repositorio", variant: "destructive" })
      return
    }
    setImporting(true)
    try {
      const created = await api.post<Deployment>("/deployments", {
        repoFullName: form.repoFullName,
        branch: form.branch,
        rootDir: form.rootDir,
        framework: form.framework || undefined,
        buildCommand: form.buildCommand || undefined,
        startCommand: form.startCommand || undefined,
      })
      setShowImport(false)
      toast({ title: "Proyecto importado", description: "Preparando instancia y lanzando primer deploy..." })
      await api.post(`/deployments/${created.id}/trigger`).catch(() => {})
      await load()
      router.push(`/dashboard/integrations/${created.id}`)
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
          description="Conecta GitHub, importa un repo y cada push se despliega automáticamente. Sin configurar instancias."
          actions={
            github ? (
              <Button className="h-9 gap-1.5" onClick={openImport}>
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

        {/* Projects */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Button className="mt-5 h-9 gap-1.5" onClick={openImport}>
              <Plus className="size-3.5" /> Importar proyecto
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {deployments.map((d) => (
              <ProjectCard key={d.id} dep={d} onDeploy={handleDeploy} onOpen={(id) => router.push(`/dashboard/integrations/${id}`)} />
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
              Elige un repo. Detectamos el framework y configuramos build/start automáticamente. Cada push se despliega solo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Repositorio</label>
              <select
                value={form.repoFullName}
                onChange={(e) => onSelectRepo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Seleccionar repositorio...</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.fullName}>{r.fullName}{r.private ? " (privado)" : ""}</option>
                ))}
              </select>
            </div>

            {/* Framework detectado */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              {detecting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Detectando framework...</span>
                </>
              ) : form.framework ? (
                <>
                  <Sparkles className="size-3.5 text-blue-500" />
                  <span>Framework detectado:</span>
                  <span className="font-medium">{form.framework}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Elige un repo para detectar el framework.</span>
              )}
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
              <Input value={form.buildCommand} onChange={(e) => setForm((f) => ({ ...f, buildCommand: e.target.value }))} className="h-9 font-mono text-xs" placeholder="npm install && npm run build" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start command</label>
              <Input value={form.startCommand} onChange={(e) => setForm((f) => ({ ...f, startCommand: e.target.value }))} className="h-9 font-mono text-xs" placeholder="npm run start" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button className="h-9 gap-1.5" onClick={handleImport} disabled={importing || detecting}>
              {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
              Importar y desplegar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
