"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { StorageSkeleton } from "@/components/skeletons/page-skeletons"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  FolderPlus,
  Upload,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
  Search,
  BookOpen,
  ChevronRight,
  Plus,
  HardDrive,
} from "lucide-react"

interface Bucket {
  id: string
  name: string
  createdAt: string
  objectCount: number
}

interface StorageObject {
  id: string
  key: string
  size: number
  mimeType: string | null
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "hace menos de un minuto"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `hace ${hours}h`
}

export default function StoragePage() {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [selected, setSelected] = useState<Bucket | null>(null)
  const [objects, setObjects] = useState<StorageObject[]>([])
  const [newBucket, setNewBucket] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState("")
  const [objectSearch, setObjectSearch] = useState("")
  const [showCreateBucket, setShowCreateBucket] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [deleteTarget, setDeleteTarget] = useState<{ type: "bucket" | "object"; id: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadBuckets(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await api.get<Bucket[]>("/storage/buckets")
      setBuckets(data)
      setLastUpdated(new Date())
      if (selected && !data.find((b) => b.id === selected.id)) setSelected(null)
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadObjects(bucketId: string) {
    try {
      const data = await api.get<StorageObject[]>(`/storage/buckets/${bucketId}/objects`)
      setObjects(data)
    } catch {}
  }

  useEffect(() => {
    loadBuckets()
  }, [])

  useEffect(() => {
    if (selected) loadObjects(selected.id)
    else setObjects([])
  }, [selected])

  async function createBucket() {
    if (!newBucket.trim()) return
    try {
      const bucket = await api.post<Bucket>("/storage/buckets", { name: newBucket.trim() })
      setNewBucket("")
      setShowCreateBucket(false)
      await loadBuckets(true)
      setSelected(bucket)
      toast({ title: "Bucket creado", description: bucket.name })
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    }
  }

  async function uploadFile(file: File) {
    if (!selected) return
    setUploading(true)
    const form = new FormData()
    form.append("file", file)
    form.append("key", file.name)
    const token = localStorage.getItem("token")
    try {
      const res = await fetch(`${API_URL}/storage/buckets/${selected.id}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(formatApiError(d.message, "Error al subir"))
      }
      await loadObjects(selected.id)
      await loadBuckets(true)
      toast({ title: "Archivo subido", description: file.name })
    } catch (err) {
      toast({
        title: "Error al subir",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  async function downloadObject(obj: StorageObject) {
    if (!selected) return
    const token = localStorage.getItem("token")
    const res = await fetch(
      `${API_URL}/storage/buckets/${selected.id}/objects/${obj.id}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
    if (!res.ok) {
      toast({ title: "Error al descargar", variant: "destructive" })
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = obj.key.split("/").pop() || "download"
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredBuckets = buckets.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredObjects = objects.filter((o) =>
    o.key.toLowerCase().includes(objectSearch.toLowerCase())
  )

  const totalSize = objects.reduce((sum, o) => sum + o.size, 0)

  return (
    <>
      <Header title="Object Storage" breadcrumbs={[{ label: "Storage" }]} />
      <PageShell maxWidth="full">
        {loading && buckets.length === 0 ? (
          <StorageSkeleton />
        ) : (
          <>
        <PageHeader
          title="Buckets"
          description="Almacenamiento de objetos estilo S3"
          actions={
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mr-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => loadBuckets(true)}
                  disabled={refreshing}
                  aria-label="Actualizar"
                >
                  <RefreshCw className={refreshing ? "animate-spin" : ""} />
                </Button>
                <span>Actualizado {timeAgo(lastUpdated)}</span>
              </div>
              <Button variant="outline" asChild>
                <Link href="/dashboard/storage/docs">
                  <BookOpen /> Documentación
                </Link>
              </Button>
              <Button onClick={() => setShowCreateBucket(true)}>
                <Plus /> Crear bucket
              </Button>
            </>
          }
        />

        {showCreateBucket && (
          <div className="rounded-2xl border border-border p-4 space-y-1.5">
            <label className="text-sm font-medium">Nombre del bucket</label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input
                className="flex-1"
                placeholder="mi-bucket"
                value={newBucket}
                onChange={(e) => setNewBucket(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createBucket()}
                autoFocus
              />
              <div className="flex gap-2 shrink-0">
                <Button onClick={createBucket}>
                  <FolderPlus /> Crear
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBucket(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Solo minúsculas, números y guiones.</p>
          </div>
        )}

        <div className="rounded-2xl border border-border overflow-hidden flex flex-col lg:flex-row min-h-[520px]">
          {/* Buckets panel */}
          <div className="lg:w-64 border-b lg:border-b-0 lg:border-r bg-muted/20 shrink-0">
            <div className="px-3 py-2.5 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar buckets..."
                  className="flex h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="p-2">
              {loading ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2 p-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando...
                </p>
              ) : filteredBuckets.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="Sin buckets"
                  description={search ? "No hay buckets que coincidan" : "Crea tu primer bucket para empezar"}
                  className="border-0 bg-transparent py-8"
                  action={
                    !search ? (
                      <Button onClick={() => setShowCreateBucket(true)}>
                        <Plus /> Crear bucket
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-0.5">
                  {filteredBuckets.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelected(b)}
                      className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                        selected?.id === b.id
                          ? "bg-accent font-medium ring-1 ring-inset ring-ring/30"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs truncate flex-1">{b.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {b.objectCount}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Objects panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected ? (
              <>
                {/* Bucket header */}
                <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                      <span>Buckets</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="font-mono text-foreground">{selected.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{objects.length} objetos</span>
                      <span>·</span>
                      <span>{formatBytes(totalSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        await uploadFile(f)
                        e.target.value = ""
                      }}
                    />
                    <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Upload />
                      )}
                      Subir
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget({ type: "bucket", id: selected.id })}
                    >
                      <Trash2 />
                      Eliminar bucket
                    </Button>
                  </div>
                </div>

                {/* Object search */}
                <div className="px-4 py-2 border-b bg-muted/30">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={objectSearch}
                      onChange={(e) => setObjectSearch(e.target.value)}
                      placeholder="Buscar objetos por nombre..."
                      className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {/* Objects table */}
                {filteredObjects.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <EmptyState
                      icon={HardDrive}
                      title={objectSearch ? "Sin resultados" : "Bucket vacío"}
                      description={
                        objectSearch
                          ? "No hay objetos que coincidan con tu búsqueda"
                          : "Sube tu primer archivo para empezar"
                      }
                      className="border-0 bg-transparent w-full max-w-md"
                      action={
                        !objectSearch ? (
                          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                            <Upload /> Subir archivo
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre (key)</th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Tamaño</th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Tipo</th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Modificado</th>
                          <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredObjects.map((obj) => (
                          <tr key={obj.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="p-4 font-mono text-xs">{obj.key}</td>
                            <td className="p-4 text-xs text-muted-foreground">{formatBytes(obj.size)}</td>
                            <td className="p-4 text-xs text-muted-foreground">{obj.mimeType || "—"}</td>
                            <td className="p-4 text-xs text-muted-foreground">
                              {new Date(obj.createdAt).toLocaleString()}
                            </td>
                            <td className="p-4">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => downloadObject(obj)}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget({ type: "object", id: obj.id })}
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <EmptyState
                  icon={Database}
                  title="Selecciona un bucket"
                  description="Elige un bucket de la lista o crea uno nuevo"
                  className="border-0 bg-transparent w-full max-w-md"
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setShowCreateBucket(true)}>
                        <Plus /> Crear bucket
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/dashboard/storage/docs">
                          <BookOpen /> Ver documentación
                        </Link>
                      </Button>
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </PageShell>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.type === "bucket" ? "¿Eliminar bucket?" : "¿Eliminar objeto?"}
        description={
          deleteTarget?.type === "bucket"
            ? "Se eliminarán todos los archivos del bucket en el servidor. Esta acción no se puede deshacer."
            : "El archivo se eliminará del servidor y de la base de datos."
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!deleteTarget || !selected) return
          try {
            if (deleteTarget.type === "bucket") {
              await api.delete(`/storage/buckets/${deleteTarget.id}`)
              setSelected(null)
              await loadBuckets(true)
            } else {
              await api.delete(`/storage/buckets/${selected.id}/objects/${deleteTarget.id}`)
              await loadObjects(selected.id)
              await loadBuckets(true)
            }
            toast({ title: "Eliminado" })
          } catch (err) {
            toast({
              title: "Error al eliminar",
              description: formatApiError(err instanceof Error ? err.message : undefined),
              variant: "destructive",
            })
          }
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
