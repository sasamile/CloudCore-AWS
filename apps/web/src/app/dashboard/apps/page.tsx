"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { Boxes, Plus, Copy, Check, AlertTriangle, Pencil, Trash2, Users } from "lucide-react"

interface OAuthClient {
  id: string
  clientId: string
  name: string
  redirectUris: string[]
  postLogoutUris: string[]
  allowedScopes: string[]
  isPublic: boolean
  createdAt: string
}

interface NewClient {
  clientId: string
  clientSecret: string | null
  name: string
  isPublic: boolean
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [c, setC] = useState(false)
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value)
            setC(true)
            setTimeout(() => setC(false), 1200)
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent"
        >
          {c ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}

function AppsListSkeleton() {
  return (
    <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-52" />
          </div>
          <div className="flex gap-1 shrink-0">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AppsPage() {
  const [clients, setClients] = useState<OAuthClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<OAuthClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OAuthClient | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<NewClient | null>(null)

  const [name, setName] = useState("")
  const [redirects, setRedirects] = useState("")
  const [logouts, setLogouts] = useState("")
  const [scopes, setScopes] = useState("openid profile email offline_access")
  const [isPublic, setIsPublic] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setClients(await api.get<OAuthClient[]>("/zynauth/clients"))
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  function parseLines(v: string): string[] {
    return v
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function parseScopes(v: string): string[] {
    return v
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function resetForm() {
    setName("")
    setRedirects("")
    setLogouts("")
    setScopes("openid profile email offline_access")
    setIsPublic(false)
  }

  function openEdit(c: OAuthClient) {
    setEditTarget(c)
    setName(c.name)
    setRedirects(c.redirectUris.join("\n"))
    setLogouts((c.postLogoutUris ?? []).join("\n"))
    setScopes(c.allowedScopes.join(" "))
  }

  async function create() {
    const redirectUris = parseLines(redirects)
    if (!name.trim() || redirectUris.length === 0) {
      toast({
        title: "Faltan datos",
        description: "Nombre y al menos una redirect URI.",
        variant: "destructive",
      })
      return
    }
    setBusy(true)
    try {
      const res = await api.post<NewClient>("/zynauth/clients", {
        name: name.trim(),
        redirectUris,
        postLogoutUris: parseLines(logouts),
        isPublic,
      })
      setCreated(res)
      setShowCreate(false)
      resetForm()
      await load()
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!editTarget) return
    const redirectUris = parseLines(redirects)
    if (!name.trim() || redirectUris.length === 0) {
      toast({
        title: "Faltan datos",
        description: "Nombre y al menos una redirect URI.",
        variant: "destructive",
      })
      return
    }
    setBusy(true)
    try {
      await api.patch(`/zynauth/clients/${editTarget.id}`, {
        name: name.trim(),
        redirectUris,
        postLogoutUris: parseLines(logouts),
        allowedScopes: parseScopes(scopes),
      })
      setEditTarget(null)
      resetForm()
      await load()
      toast({ title: "App actualizada" })
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header title="Apps (ZynAuth)" breadcrumbs={[{ label: "Identity" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Aplicaciones registradas"
          description='Apps que autentican usuarios vía ZynAuth — equivale a los "App Clients" de Cognito.'
          actions={
            <Button
              className="h-9"
              onClick={() => {
                resetForm()
                setShowCreate(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Registrar app
            </Button>
          }
        />

        {loading ? (
          <AppsListSkeleton />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No hay apps registradas"
            description="Registra tu primera app para empezar a autenticar usuarios."
            action={
              <Button
                className="h-9"
                onClick={() => {
                  resetForm()
                  setShowCreate(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Registrar la primera
              </Button>
            }
          />
        ) : (
          <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <Badge
                      variant={c.isPublic ? "secondary" : "default"}
                      className="text-[10px] shrink-0"
                    >
                      {c.isPublic ? "PKCE" : "confidential"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    <code className="font-mono">{c.clientId}</code>
                    {c.redirectUris[0] && (
                      <span>
                        {" · "}
                        {c.redirectUris[0]}
                        {c.redirectUris.length > 1 ? ` +${c.redirectUris.length - 1}` : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Usuarios" asChild>
                    <Link href={`/dashboard/apps/${c.clientId}/users`}>
                      <Users className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageShell>

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(o) => {
          if (!o) {
            setShowCreate(false)
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar app</DialogTitle>
            <DialogDescription>Configura las URLs de retorno de tu aplicación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mi-app"
                className="mt-1 h-9"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Redirect URIs</label>
              <textarea
                value={redirects}
                onChange={(e) => setRedirects(e.target.value)}
                placeholder={"https://mi-app.com/api/auth/callback\nhttp://localhost:3000/api/auth/callback"}
                className="mt-1 flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">Una por línea (o separadas por coma).</p>
            </div>
            <div>
              <label className="text-sm font-medium">Post-logout URIs (opcional)</label>
              <textarea
                value={logouts}
                onChange={(e) => setLogouts(e.target.value)}
                placeholder="https://mi-app.com"
                className="mt-1 flex min-h-[48px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-input"
              />
              Cliente público — SPA / móvil (sin secret, PKCE obligatorio)
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                setShowCreate(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button className="h-9" onClick={create} disabled={busy}>
              {busy ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) {
            setEditTarget(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar app</DialogTitle>
            <DialogDescription>
              <code className="font-mono text-xs">{editTarget?.clientId}</code>
              {" · "}el tipo ({editTarget?.isPublic ? "público" : "confidencial"}) no se puede cambiar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Redirect URIs</label>
              <textarea
                value={redirects}
                onChange={(e) => setRedirects(e.target.value)}
                className="mt-1 flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Post-logout URIs</label>
              <textarea
                value={logouts}
                onChange={(e) => setLogouts(e.target.value)}
                className="mt-1 flex min-h-[48px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scopes</label>
              <Input
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                className="mt-1 h-9 font-mono text-sm"
                placeholder="openid profile email offline_access"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                setEditTarget(null)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button className="h-9" onClick={saveEdit} disabled={busy}>
              {busy ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created secret dialog */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>App registrada: {created?.name}</DialogTitle>
            {created?.clientSecret && (
              <DialogDescription className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Copia el client secret ahora. No se volverá a mostrar.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <CopyRow label="Client ID" value={created?.clientId || ""} />
            {created?.clientSecret ? (
              <CopyRow label="Client Secret" value={created.clientSecret} />
            ) : (
              <p className="text-xs text-muted-foreground">Cliente público — usa PKCE, sin secret.</p>
            )}
          </div>
          <DialogFooter>
            <Button className="h-9" onClick={() => setCreated(null)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="¿Borrar app?"
        description={`Se eliminará "${deleteTarget?.name}". Las apps que usen este client_id dejarán de autenticar. Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        destructive
        loading={busy}
        onConfirm={async () => {
          if (!deleteTarget) return
          setBusy(true)
          try {
            await api.delete(`/zynauth/clients/${deleteTarget.id}`)
            await load()
            toast({ title: "App eliminada" })
            setDeleteTarget(null)
          } catch (err) {
            toast({
              title: "Error",
              description: formatApiError(err instanceof Error ? err.message : undefined),
              variant: "destructive",
            })
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}
