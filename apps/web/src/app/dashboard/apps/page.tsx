"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Boxes, Plus, Loader2, Copy, Check, AlertTriangle, Pencil, Trash2 } from "lucide-react"

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
      <div className="flex items-center gap-2 mt-1">
        <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all">{value}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1200) }}
          className="inline-flex items-center justify-center rounded border w-7 h-7 hover:bg-accent shrink-0"
        >
          {c ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
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
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function parseLines(v: string): string[] {
    return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
  }

  function parseScopes(v: string): string[] {
    return v.split(/\s+/).map((s) => s.trim()).filter(Boolean)
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
      toast({ title: "Faltan datos", description: "Nombre y al menos una redirect URI.", variant: "destructive" })
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
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!editTarget) return
    const redirectUris = parseLines(redirects)
    if (!name.trim() || redirectUris.length === 0) {
      toast({ title: "Faltan datos", description: "Nombre y al menos una redirect URI.", variant: "destructive" })
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
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header title="Apps (ZynAuth)" breadcrumbs={[{ label: "Identity" }, { label: "Apps" }]} />
      <div className="w-full max-w-4xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Aplicaciones registradas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Apps que autentican usuarios vía ZynAuth (equivale a los "App Clients" de Cognito).
            </p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true) }}><Plus className="w-3.5 h-3.5" /> Registrar app</Button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : clients.length === 0 ? (
          <div className="rounded-lg border p-12 text-center">
            <Boxes className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No hay apps registradas.</p>
            <Button size="sm" onClick={() => { resetForm(); setShowCreate(true) }}><Plus className="w-3.5 h-3.5" /> Registrar la primera</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => (
              <div key={c.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Boxes className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{c.name}</span>
                    <Badge variant={c.isPublic ? "secondary" : "default"}>{c.isPublic ? "público (PKCE)" : "confidencial"}</Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <code className="font-mono text-xs text-muted-foreground hidden sm:inline">{c.clientId}</code>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="sm:hidden"><span className="text-foreground/70">Client ID:</span> <code className="font-mono">{c.clientId}</code></div>
                  <div><span className="text-foreground/70">Redirect URIs:</span> {c.redirectUris.join(", ")}</div>
                  <div><span className="text-foreground/70">Scopes:</span> {c.allowedScopes.join(" ")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crear */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar app</DialogTitle>
            <DialogDescription>Configura las URLs de retorno de tu aplicación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="orbidev" className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Redirect URIs</label>
              <textarea
                value={redirects}
                onChange={(e) => setRedirects(e.target.value)}
                placeholder={"https://mi-app.com/api/auth/callback\nhttp://localhost:3000/api/auth/callback"}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Una por línea (o separadas por coma).</p>
            </div>
            <div>
              <label className="text-sm font-medium">Post-logout URIs (opcional)</label>
              <textarea
                value={logouts}
                onChange={(e) => setLogouts(e.target.value)}
                placeholder="https://mi-app.com"
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[48px] font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded border-input" />
              Cliente público (SPA/móvil, sin secret — PKCE obligatorio)
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm() }}>Cancelar</Button>
            <Button onClick={create} disabled={busy}>{busy ? "..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); resetForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar app</DialogTitle>
            <DialogDescription>
              {editTarget?.clientId} · el tipo ({editTarget?.isPublic ? "público" : "confidencial"}) no se puede cambiar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Redirect URIs</label>
              <textarea
                value={redirects}
                onChange={(e) => setRedirects(e.target.value)}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Post-logout URIs</label>
              <textarea
                value={logouts}
                onChange={(e) => setLogouts(e.target.value)}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[48px] font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scopes</label>
              <Input value={scopes} onChange={(e) => setScopes(e.target.value)} className="mt-1 font-mono text-sm" placeholder="openid profile email offline_access" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setEditTarget(null); resetForm() }}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? "..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credenciales una vez */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>App registrada: {created?.name}</DialogTitle>
            {created?.clientSecret && (
              <DialogDescription className="flex items-center gap-1.5 text-amber-500">
                <AlertTriangle className="w-4 h-4" /> Copia el client secret ahora. No se volverá a mostrar.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <CopyRow label="Client ID" value={created?.clientId || ""} />
            {created?.clientSecret ? (
              <CopyRow label="Client Secret" value={created.clientSecret} />
            ) : (
              <p className="text-xs text-muted-foreground">Cliente público: no tiene secret, usa PKCE.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Listo</Button>
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
            toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}
