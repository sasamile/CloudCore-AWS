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
import { Cylinder, Plus, Loader2, Copy, Check, Trash2, Eye, AlertTriangle } from "lucide-react"

interface ManagedDb {
  id: string
  name: string
  dbName: string
  username: string
  host: string
  port: number
  status: string
  createdAt: string
}

function statusColor(s: string) {
  if (s === "ready") return "default"
  if (s === "error") return "destructive"
  return "secondary"
}

export default function DatabasesPage() {
  const [dbs, setDbs] = useState<ManagedDb[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [conn, setConn] = useState<{ title: string; value: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setDbs(await api.get<ManagedDb[]>("/databases"))
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await api.post<{ connectionString: string; name: string }>("/databases", { name: name.trim() })
      setShowCreate(false)
      setName("")
      await load()
      setConn({ title: `Base de datos "${res.name}" creada`, value: res.connectionString })
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function reveal(db: ManagedDb) {
    try {
      const res = await api.get<{ connectionString: string }>(`/databases/${db.id}/connection-string`)
      setConn({ title: `Connection string · ${db.name}`, value: res.connectionString })
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    }
  }

  return (
    <>
      <Header title="Databases" breadcrumbs={[{ label: "Data" }, { label: "Databases" }]} />
      <div className="w-full max-w-4xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Bases de datos gestionadas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Postgres bajo demanda (DBaaS). Cada una trae su propio rol y credenciales.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> Nueva base de datos</Button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : dbs.length === 0 ? (
          <div className="rounded-lg border p-12 text-center">
            <Cylinder className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No tienes bases de datos.</p>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> Crear la primera</Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Base (real)</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Host</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {dbs.map((db) => (
                  <tr key={db.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4">{db.name}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{db.dbName}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{db.host}:{db.port}</td>
                    <td className="p-4"><Badge variant={statusColor(db.status) as any}>{db.status}</Badge></td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver connection string" onClick={() => reveal(db)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(db.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Crear */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setName("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva base de datos</DialogTitle>
            <DialogDescription>Se creará un database Postgres con su rol dedicado.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="miapp" onKeyDown={(e) => e.key === "Enter" && create()} autoFocus />
          <p className="text-xs text-muted-foreground">Empieza por letra; solo a-z, 0-9, _.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowCreate(false); setName("") }}>Cancelar</Button>
            <Button onClick={create} disabled={busy || !name.trim()}>{busy ? "..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection string */}
      <Dialog open={!!conn} onOpenChange={(o) => !o && setConn(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{conn?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-500">
              <AlertTriangle className="w-4 h-4" /> Contiene la contraseña. Guárdalo de forma segura.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all">{conn?.value}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(conn?.value || ""); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
              className="inline-flex items-center justify-center rounded border w-8 h-8 hover:bg-accent shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <DialogFooter>
            <Button onClick={() => setConn(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="¿Eliminar base de datos?"
        description="Se borrará el database y su rol en el servidor. Todos los datos se perderán. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.delete(`/databases/${deleteTarget}`)
            await load()
            toast({ title: "Base de datos eliminada" })
          } catch (err) {
            toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
          }
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
