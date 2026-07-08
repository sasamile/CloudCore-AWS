"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CardsSkeleton } from "@/components/skeletons/page-skeletons"
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
      <Header
        title="Deploy"
        breadcrumbs={[{ label: "Compute", href: "/dashboard/instances" }]}
      />
      <div className="w-full px-4 py-6 sm:px-6 space-y-6">
        {loading ? (
          <CardsSkeleton count={3} />
        ) : (
          <>
        <div>
          <h2 className="text-xl font-semibold">Desplegar desde GitHub</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecta tu cuenta, elige un repositorio y despliega en una instancia — como Vercel.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Github className="w-4 h-4" /> GitHub
            </CardTitle>
            <CardDescription>
              Acceso a tus repositorios para clonar y desplegar automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            {github ? (
              <div className="flex items-center gap-3">
                <Badge variant="success">Conectado</Badge>
                <span className="text-sm font-medium">@{github.username}</span>
                {github.email && (
                  <span className="text-xs text-muted-foreground">{github.email}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No conectado</p>
            )}
            <div className="flex gap-2">
              {github ? (
                <>
                  <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={disconnectGithub}>
                    <Unplug className="w-3.5 h-3.5" /> Desconectar
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={connectGithub} disabled={connecting}>
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                  Conectar GitHub
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {github && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Nuevo despliegue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.fullName}>
                        {r.fullName} {r.private ? "🔒" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Instancia</label>
                  <select
                    value={selectedInstance}
                    onChange={(e) => setSelectedInstance(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Build</label>
                  <Input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start command</label>
                <Input value={startCommand} onChange={(e) => setStartCommand(e.target.value)} />
              </div>
              <Button onClick={handleDeploy} disabled={deploying || !selectedRepo || !selectedInstance}>
                {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                Desplegar
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> Historial de despliegues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : deployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay despliegues.</p>
            ) : (
              <div className="space-y-2">
                {deployments.map((d) => (
                  <div key={d.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{d.repoFullName}</span>
                      <Badge
                        variant={
                          d.status === "success" ? "success" : d.status === "error" ? "destructive" : "secondary"
                        }
                      >
                        {d.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      → {d.instance.name} · rama {d.branch} · {new Date(d.updatedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </>
  )
}
