"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Github,
  Loader2,
  Rocket,
  Unplug,
  RefreshCw,
  GitBranch,
} from "lucide-react"

interface Integration {
  id: string
  provider: string
  username: string | null
  email: string | null
  scope: string | null
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
  status: string
  lastLog: string | null
  updatedAt: string
  instance: { name: string }
}

function DeployFormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-4 flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="rounded-2xl border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
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
  const [deploying, setDeploying] = useState(false)

  const [selectedRepo, setSelectedRepo] = useState("")
  const [selectedInstance, setSelectedInstance] = useState("")
  const [branch, setBranch] = useState("main")
  const [buildCommand, setBuildCommand] = useState("npm install && npm run build")
  const [startCommand, setStartCommand] = useState("nohup npm start > /tmp/app.log 2>&1 &")

  const github = integrations.find((i) => i.provider === "github")

  async function load() {
    try {
      const [ints, insts, deps] = await Promise.all([
        api.get<Integration[]>("/integrations"),
        api.get<Instance[]>("/instances"),
        api.get<Deployment[]>("/integrations/deployments"),
      ])
      setIntegrations(ints)
      setInstances(insts)
      setDeployments(deps)

      if (ints.some((i) => i.provider === "github")) {
        const repoList = await api.get<Repo[]>("/integrations/github/repos")
        setRepos(repoList)
        if (repoList[0] && !selectedRepo) {
          setSelectedRepo(repoList[0].fullName)
          setBranch(repoList[0].defaultBranch)
        }
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const gh = searchParams.get("github")
    if (gh === "connected") toast({ title: "GitHub conectado" })
    if (gh === "error") toast({ title: "Error al conectar GitHub", variant: "destructive" })
  }, [searchParams])

  async function connectGithub() {
    setConnecting(true)
    try {
      const { url } = await api.get<{ url: string }>("/integrations/github/authorize")
      window.location.href = url
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
      setConnecting(false)
    }
  }

  async function disconnectGithub() {
    await api.delete("/integrations/account/github")
    setRepos([])
    load()
    toast({ title: "GitHub desconectado" })
  }

  async function handleDeploy() {
    if (!selectedRepo || !selectedInstance) return
    setDeploying(true)
    try {
      await api.post("/integrations/github/deploy", {
        instanceId: selectedInstance,
        repoFullName: selectedRepo,
        branch,
        buildCommand,
        startCommand,
      })
      toast({ title: "Despliegue completado", description: selectedRepo })
      load()
    } catch (err) {
      toast({
        title: "Error al desplegar",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setDeploying(false)
    }
  }

  return (
    <>
      <Header title="Deploy" breadcrumbs={[{ label: "Compute", href: "/dashboard/instances" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Desplegar desde GitHub"
          description="Conecta tu cuenta, elige un repositorio y despliega en una instancia."
        />

        {loading ? (
          <DeployFormSkeleton />
        ) : (
          <>
            {/* GitHub connection */}
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <Github className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">GitHub</p>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                {github ? (
                  <div className="flex items-center gap-3">
                    <Badge variant="success">Conectado</Badge>
                    <span className="text-sm font-medium">@{github.username}</span>
                    {github.email && (
                      <span className="text-xs text-muted-foreground">{github.email}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Conecta tu cuenta para acceder a repositorios.
                  </p>
                )}
                <div className="flex gap-2 shrink-0">
                  {github ? (
                    <>
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={load} aria-label="Actualizar">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" className="h-9" onClick={disconnectGithub}>
                        <Unplug className="w-3.5 h-3.5" /> Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button className="h-9" onClick={connectGithub} disabled={connecting}>
                      {connecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Github className="w-3.5 h-3.5" />
                      )}
                      Conectar GitHub
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Deploy form */}
            {github && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                  <Rocket className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">Nuevo despliegue</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Repositorio</label>
                      <select
                        value={selectedRepo}
                        onChange={(e) => {
                          setSelectedRepo(e.target.value)
                          const repo = repos.find((r) => r.fullName === e.target.value)
                          if (repo) setBranch(repo.defaultBranch)
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {repos.map((r) => (
                          <option key={r.id} value={r.fullName}>
                            {r.fullName}
                            {r.private ? " (privado)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Instancia</label>
                      <select
                        value={selectedInstance}
                        onChange={(e) => setSelectedInstance(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Seleccionar...</option>
                        {instances
                          .filter((i) => i.status === "running")
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Rama</label>
                      <Input
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Build command</label>
                      <Input
                        value={buildCommand}
                        onChange={(e) => setBuildCommand(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start command</label>
                    <Input
                      value={startCommand}
                      onChange={(e) => setStartCommand(e.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <Button
                    className="h-9"
                    onClick={handleDeploy}
                    disabled={deploying || !selectedRepo || !selectedInstance}
                  >
                    {deploying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Rocket className="w-3.5 h-3.5" />
                    )}
                    Desplegar
                  </Button>
                </div>
              </div>
            )}

            {/* Deployment history */}
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">Historial de despliegues</p>
              </div>
              {deployments.length === 0 ? (
                <EmptyState
                  icon={Rocket}
                  title="Aún no hay despliegues"
                  description="Conecta GitHub y lanza tu primer despliegue desde arriba."
                  className="border-0 bg-transparent py-10"
                />
              ) : (
                <div className="divide-y divide-border">
                  {deployments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-medium truncate">{d.repoFullName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.instance.name} · rama {d.branch} ·{" "}
                          {new Date(d.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant={
                          d.status === "success"
                            ? "success"
                            : d.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                        className="shrink-0"
                      >
                        {d.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </PageShell>
    </>
  )
}
