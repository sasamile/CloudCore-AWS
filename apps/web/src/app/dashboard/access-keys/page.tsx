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
import { KeyRound, Plus, Trash2, Loader2, Copy, Check, AlertTriangle } from "lucide-react"

interface AccessKey {
  id: string
  accessKeyId: string
  label: string
  scopes: string[]
  lastUsedAt: string | null
  revoked: boolean
  createdAt: string
}

interface NewKey {
  accessKeyId: string
  secretAccessKey: string
  label: string
}

function CopyBtn({ value }: { value: string }) {
  const [c, setC] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1200) }}
      className="inline-flex items-center justify-center rounded border w-7 h-7 hover:bg-accent transition-colors shrink-0"
    >
      {c ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function AccessKeysPage() {
  const [keys, setKeys] = useState<AccessKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<NewKey | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setKeys(await api.get<AccessKey[]>("/zynauth/access-keys"))
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!label.trim()) return
    setBusy(true)
    try {
      const res = await api.post<NewKey>("/zynauth/access-keys", { label: label.trim() })
      setCreated(res)
      setShowCreate(false)
      setLabel("")
      await load()
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header title="Access Keys" breadcrumbs={[{ label: "Identity" }, { label: "Access Keys" }]} />
      <div className="w-full max-w-4xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Access Keys</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Credenciales de máquina para el SDK <code className="text-xs">@zyncloud/storage</code> (firma ZYN1).
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Nueva Access Key
          </Button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border p-12 text-center">
            <KeyRound className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Aún no tienes access keys.</p>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> Crear la primera</Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Etiqueta</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Access Key ID</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Scopes</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Último uso</th>
                  <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4">{k.label}{k.revoked && <Badge variant="secondary" className="ml-2">revocada</Badge>}</td>
                    <td className="p-4 font-mono text-xs">{k.accessKeyId}</td>
                    <td className="p-4 text-xs text-muted-foreground">{k.scopes.join(", ")}</td>
                    <td className="p-4 text-xs text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "nunca"}</td>
                    <td className="p-4 text-right">
                      {!k.revoked && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={() => setRevokeTarget(k.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Crear */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setLabel("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Access Key</DialogTitle>
            <DialogDescription>Ponle una etiqueta para identificar dónde la usarás.</DialogDescription>
          </DialogHeader>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mi-app-produccion" onKeyDown={(e) => e.key === "Enter" && create()} autoFocus />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowCreate(false); setLabel("") }}>Cancelar</Button>
            <Button onClick={create} disabled={busy || !label.trim()}>{busy ? "..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret mostrado una vez */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Access Key creada</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-500">
              <AlertTriangle className="w-4 h-4" /> Copia el secret ahora. No se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Access Key ID</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all">{created?.accessKeyId}</code>
                <CopyBtn value={created?.accessKeyId || ""} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Secret Access Key</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all">{created?.secretAccessKey}</code>
                <CopyBtn value={created?.secretAccessKey || ""} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Listo, la guardé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="¿Revocar access key?"
        description="Las apps que la usen dejarán de tener acceso inmediatamente. Esta acción no se puede deshacer."
        confirmLabel="Revocar"
        destructive
        onConfirm={async () => {
          if (!revokeTarget) return
          try {
            await api.delete(`/zynauth/access-keys/${revokeTarget}`)
            await load()
            toast({ title: "Access key revocada" })
          } catch (err) {
            toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
          }
          setRevokeTarget(null)
        }}
      />
    </>
  )
}
