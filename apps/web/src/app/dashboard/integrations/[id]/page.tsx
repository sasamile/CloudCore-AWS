"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { PageShell } from "@/components/layout/page-shell"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/deployments/status-badge"
import {
  Github,
  GitBranch,
  Play,
  Loader2,
  ArrowLeft,
  Sparkles,
  FolderTree,
  Terminal,
  Zap,
  ExternalLink,
  Trash2,
} from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface Deployment {
  id: string
  repoFullName: string
  branch: string
  rootDir: string
  framework: string | null
  port: number | null
  hostname: string | null
  buildCommand: string | null
  startCommand: string | null
  status: string
  lastLog: string | null
  createdAt: string
  updatedAt: string
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" /> {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export default function DeploymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [dep, setDep] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.get<Deployment>(`/deployments/${id}`)
      setDep(d)
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Auto-refresca mientras compila/despliega.
  useEffect(() => {
    if (!dep) return
    const active = dep.status === "deploying" || dep.status === "building"
    if (!active) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [dep, load])

  async function redeploy() {
    setDeploying(true)
    try {
      await api.post(`/deployments/${id}/trigger`)
      toast({ title: "Despliegue iniciado" })
      setTimeout(load, 1200)
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setDeploying(false)
    }
  }

  async function removeProject() {
    setDeleting(true)
    try {
      await api.delete(`/deployments/${id}`)
      toast({ title: "Proyecto eliminado" })
      router.push("/dashboard/integrations")
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const repoName = dep?.repoFullName.split("/")[1] ?? dep?.repoFullName ?? ""
  const busy = dep?.status === "deploying" || dep?.status === "building"

  return (
    <>
      <Header title={repoName || "Proyecto"} breadcrumbs={[
        { label: "Compute", href: "/dashboard/instances" },
        { label: "Deployments", href: "/dashboard/integrations" },
      ]} />
      <PageShell maxWidth="full">
        <button
          onClick={() => router.push("/dashboard/integrations")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" /> Volver a Deployments
        </button>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : !dep ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center text-sm text-muted-foreground">
            Proyecto no encontrado.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Github className="size-5 text-muted-foreground" />
                  <h1 className="text-xl font-semibold">{repoName}</h1>
                  <StatusBadge status={dep.status} />
                </div>
                <a
                  href={`https://github.com/${dep.repoFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dep.repoFullName} <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Eliminar
                </Button>
                <Button className="h-9 gap-1.5" onClick={redeploy} disabled={deploying || busy || deleting}>
                  {deploying || busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  {busy ? "Desplegando..." : "Redeploy"}
                </Button>
              </div>
            </div>

            {/* URL pública */}
            {dep.hostname && (
              <a
                href={`https://${dep.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`size-2 shrink-0 rounded-full ${dep.status === "success" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">URL pública</p>
                    <p className="truncate font-mono text-sm text-foreground">{dep.hostname}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                  Visitar <ExternalLink className="size-3.5" />
                </span>
              </a>
            )}

            {/* Info grid */}
            <div className="rounded-2xl border border-border bg-card p-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field icon={GitBranch} label="Rama">
                <span className="font-mono">{dep.branch}</span>
              </Field>
              <Field icon={Sparkles} label="Framework">
                {dep.framework ?? "—"}
              </Field>
              <Field icon={FolderTree} label="Directorio raíz">
                <span className="font-mono">{dep.rootDir}</span>
              </Field>
              <Field icon={Zap} label="Puerto interno">
                <span className="font-mono">{dep.port ?? "—"}</span>
              </Field>
            </div>

            {/* Commands */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
                <Terminal className="size-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">Configuración de build</p>
              </div>
              <div className="divide-y divide-border/50">
                <div className="px-5 py-3 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Build command</p>
                  <code className="text-xs font-mono text-foreground/90 break-all">{dep.buildCommand || "(ninguno)"}</code>
                </div>
                <div className="px-5 py-3 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Start command</p>
                  <code className="text-xs font-mono text-foreground/90 break-all">{dep.startCommand || "(ninguno)"}</code>
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border bg-muted/30">
                <p className="inline-flex items-center gap-2 text-sm font-medium">
                  <Terminal className="size-3.5 text-muted-foreground" /> Logs del despliegue
                </p>
                {busy && <span className="inline-flex items-center gap-1.5 text-xs text-blue-500"><Loader2 className="size-3 animate-spin" /> en vivo</span>}
              </div>
              <pre className="max-h-[55vh] overflow-auto bg-[#0a0a0a] p-4 text-xs font-mono leading-relaxed text-neutral-300 whitespace-pre-wrap">
                {dep.lastLog || "Sin logs aún. Lanza un despliegue para ver la salida."}
              </pre>
            </div>
          </>
        )}
      </PageShell>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar proyecto?"
        description={`${repoName} dejará de desplegarse. Se detendrá el proceso y se borrará de la lista. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={() => void removeProject()}
      />
    </>
  )
}
