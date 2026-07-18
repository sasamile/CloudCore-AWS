"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { ErrorState } from "@/components/layout/error-state"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Rocket, Plus, Loader2, Play, ScrollText, GitBranch } from "lucide-react"

interface Deployment {
  id: string
  repoFullName: string
  branch: string
  rootDir: string
  buildCommand: string | null
  startCommand: string | null
  status: string
  lastLog: string | null
  instanceId: string
  updatedAt: string
}

interface Instance {
  id: string
  name: string
  status: string
}

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "live") return "default"
  if (s === "error") return "destructive"
  return "secondary"
}

export default function DeploymentsPage() {
  const [deps, setDeps] = useState<Deployment[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState<{ repo: string; text: string } | null>(null)

  const [form, setForm] = useState({
    instanceId: "", repoFullName: "", branch: "main", rootDir: ".",
    buildCommand: "npm ci && npm run build", startCommand: "npm start",
  })

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [d, inst] = await Promise.all([
        api.get<Deployment[]>("/deployments"),
        api.get<Instance[]>("/instances").catch(() => []),
      ])
      setDeps(d)
      setInstances(inst)
      if (inst[0] && !form.instanceId) setForm((f) => ({ ...f, instanceId: inst[0].id }))
    } catch (err) {
      const msg = formatApiError(err instanceof Error ? err.message : undefined)
      setError(msg)
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!form.instanceId || !form.repoFullName.trim()) {
      toast({ title: "Faltan datos", description: "Instancia y repositorio son obligatorios.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await api.post("/deployments", form)
      setShowCreate(false)
      await load()
      toast({ title: "Deployment creado", description: "Ahora puedes dispararlo." })
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function trigger(id: string) {
    try {
      await api.post(`/deployments/${id}/trigger`)
      toast({ title: "Despliegue iniciado", description: "Clonando, build y arranque en la instancia..." })
      setTimeout(load, 2000)
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    }
  }

  const instanceName = (id: string) => instances.find((i) => i.id === id)?.name || id.slice(0, 8)

  return (
    <>
      <Header title="Auto-Deploy" breadcrumbs={[{ label: "Compute" }, { label: "Auto-Deploy" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Despliegues automáticos"
          description="Clona un repo de GitHub dentro de una instancia, corre el build y arranca la app."
          actions={
            <Button className="h-9" onClick={() => setShowCreate(true)} disabled={instances.length === 0}>
              <Plus className="w-3.5 h-3.5" /> Nuevo deployment
            </Button>
          }
        />

        {instances.length === 0 && !loading && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
            Necesitas al menos una instancia corriendo para desplegar.
          </div>
        )}

        {error && !loading ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <div className="rounded-2xl border border-border p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : deps.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No hay deployments configurados"
            description="Crea un deployment para automatizar build y arranque en tus instancias."
            action={
              instances.length > 0 ? (
                <Button className="h-9" onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5" /> Nuevo deployment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {deps.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Rocket className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm truncate">{d.repoFullName}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><GitBranch className="w-3 h-3" />{d.branch}</span>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">→ {instanceName(d.instanceId)}</span>
                    {d.lastLog && (
                      <Button variant="outline" className="h-9" onClick={() => setLogs({ repo: d.repoFullName, text: d.lastLog || "" })}>
                        <ScrollText className="w-3.5 h-3.5" /> Logs
                      </Button>
                    )}
                    <Button className="h-9" onClick={() => trigger(d.id)}>
                      <Play className="w-3.5 h-3.5" /> Desplegar
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 font-mono">
                  build: {d.buildCommand || "—"} · start: {d.startCommand || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageShell>

      <Dialog open={showCreate} onOpenChange={(o) => !o && setShowCreate(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo deployment</DialogTitle>
            <DialogDescription>Configura de dónde y cómo se despliega tu app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Instancia destino</label>
              <select
                value={form.instanceId}
                onChange={(e) => setForm({ ...form, instanceId: e.target.value })}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {instances.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.status})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Repositorio (owner/repo)</label>
              <Input value={form.repoFullName} onChange={(e) => setForm({ ...form, repoFullName: e.target.value })} placeholder="sasamile/mi-app" className="mt-1 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Branch</label>
                <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium">Directorio raíz</label>
                <Input value={form.rootDir} onChange={(e) => setForm({ ...form, rootDir: e.target.value })} className="mt-1 font-mono" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Comando de build</label>
              <Input value={form.buildCommand} onChange={(e) => setForm({ ...form, buildCommand: e.target.value })} className="mt-1 font-mono" />
            </div>
            <div>
              <label className="text-sm font-medium">Comando de arranque</label>
              <Input value={form.startCommand} onChange={(e) => setForm({ ...form, startCommand: e.target.value })} className="mt-1 font-mono" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button className="h-9" onClick={create} disabled={busy}>{busy ? "..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!logs} onOpenChange={(o) => !o && setLogs(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{logs?.repo}</DialogTitle>
            <DialogDescription>Salida del último despliegue</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-auto rounded-xl border border-border bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">{logs?.text}</pre>
          <DialogFooter>
            <Button className="h-9" onClick={() => setLogs(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
