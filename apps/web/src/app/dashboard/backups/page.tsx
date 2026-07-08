"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { TableRowsSkeleton } from "@/components/skeletons/page-skeletons"
import { HardDrive, RotateCw, Trash2, Plus, RefreshCw, Search, Loader2 } from "lucide-react"

interface Backup {
  id: string
  fileName: string
  fileSize: number
  createdAt: string
  instance: { id: string; name: string }
}

interface Instance {
  id: string
  name: string
  status: string
}

export default function BackupsPage() {
  return (
    <Suspense>
      <BackupsContent />
    </Suspense>
  )
}

function BackupsContent() {
  const searchParams = useSearchParams()
  const filterInstance = searchParams.get("instance")
  const [backups, setBackups] = useState<Backup[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState(filterInstance || "")
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  async function fetchBackups() {
    try {
      const path = selectedInstance ? `/backups/${selectedInstance}` : "/backups"
      setBackups(await api.get<Backup[]>(path))
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
    api.get<Instance[]>("/instances").then(setInstances).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchBackups()
  }, [selectedInstance])

  async function handleCreate() {
    if (!selectedInstance) return
    setCreating(true)
    try {
      await api.post(`/backups/${selectedInstance}`)
      toast({ title: "Snapshot creado", description: "El respaldo se guardó correctamente." })
      fetchBackups()
    } catch (err) {
      toast({
        title: "No se pudo crear el snapshot",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleRestore(id: string) {
    if (!confirm("¿Restaurar este snapshot? La instancia se reiniciará con el estado guardado.")) return
    setRestoring(id)
    try {
      const result = await api.post<{ message: string }>(`/backups/${id}/restore`)
      toast({ title: "Restaurado", description: result.message })
      fetchBackups()
    } catch (err) {
      toast({
        title: "Error al restaurar",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setRestoring(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este snapshot permanentemente?")) return
    try {
      await api.delete(`/backups/${id}`)
      toast({ title: "Snapshot eliminado" })
      fetchBackups()
    } catch (err) {
      toast({
        title: "Error al eliminar",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filtered = backups.filter(
    (b) =>
      b.fileName.toLowerCase().includes(search.toLowerCase()) ||
      b.instance.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedInst = instances.find((i) => i.id === selectedInstance)

  return (
    <>
      <Header title="Snapshots" breadcrumbs={[{ label: "Storage" }]} />
      <div className="w-full px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Snapshots</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Guarda el estado de una instancia y restáurala cuando quieras.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="flex h-8 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Todas las instancias</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchBackups}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            {selectedInstance && (
              <Button size="sm" onClick={handleCreate} disabled={creating || selectedInst?.status !== "running"}>
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Crear snapshot
              </Button>
            )}
          </div>
        </div>

        {selectedInstance && selectedInst?.status !== "running" && (
          <p className="text-xs text-amber-600">
            La instancia debe estar en ejecución para crear un snapshot.
          </p>
        )}

        <div className="rounded-lg border">
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar snapshots..."
                className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {loading ? (
            <TableRowsSkeleton rows={5} cols={5} />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <HardDrive className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No hay snapshots que coincidan" : "Aún no hay snapshots"}
              </p>
              {!search && selectedInstance && selectedInst?.status === "running" && (
                <Button size="sm" onClick={handleCreate} disabled={creating}>
                  Crear snapshot
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Instancia</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Tamaño</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Creado</th>
                    <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium text-sm">{b.fileName}</td>
                      <td className="p-4 text-xs text-muted-foreground">{b.instance.name}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{formatSize(b.fileSize)}</td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={restoring === b.id}
                            onClick={() => handleRestore(b.id)}
                          >
                            {restoring === b.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCw className="w-3 h-3" />
                            )}
                            Restaurar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(b.id)}
                          >
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
      </div>
    </>
  )
}
