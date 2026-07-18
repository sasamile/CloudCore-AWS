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
import { TableRowsSkeleton } from "@/components/skeletons/page-skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KeyRound, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react"

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
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1200) }}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent"
    >
      {c ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
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
      <PageShell maxWidth="4xl">
        <PageHeader
          title="Access Keys"
          description="Credenciales de máquina para el SDK @zyncloud/storage (firma ZYN1)."
          actions={
            <Button className="h-9" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Nueva Access Key
            </Button>
          }
        />

        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
            <TableRowsSkeleton rows={5} cols={5} />
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Aún no tienes access keys"
            action={
              <Button className="h-9" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Crear la primera
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Etiqueta</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Access Key ID</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Scopes</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Último uso</th>
                  <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/30">
                    <td className="p-4">
                      {k.label}
                      {k.revoked && <Badge variant="secondary" className="ml-2">revocada</Badge>}
                    </td>
                    <td className="p-4 font-mono text-xs">{k.accessKeyId}</td>
                    <td className="p-4 text-xs text-muted-foreground">{k.scopes.join(", ")}</td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "nunca"}
                    </td>
                    <td className="p-4 text-right">
                      {!k.revoked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRevokeTarget(k.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setLabel("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Access Key</DialogTitle>
            <DialogDescription>Ponle una etiqueta para identificar dónde la usarás.</DialogDescription>
          </DialogHeader>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="mi-app-produccion"
            className="h-9"
            onKeyDown={(e) => e.key === "Enter" && create()}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => { setShowCreate(false); setLabel("") }}>Cancelar</Button>
            <Button className="h-9" onClick={create} disabled={busy || !label.trim()}>{busy ? "..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Access Key creada</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Copia el secret ahora. No se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Access Key ID</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
                  {created?.accessKeyId}
                </code>
                <CopyBtn value={created?.accessKeyId || ""} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Secret Access Key</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
                  {created?.secretAccessKey}
                </code>
                <CopyBtn value={created?.secretAccessKey || ""} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="h-9" onClick={() => setCreated(null)}>Listo, la guardé</Button>
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
