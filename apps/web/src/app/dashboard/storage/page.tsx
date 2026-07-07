"use client"

import { useEffect, useState, useRef } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Database, FolderPlus, Upload, Trash2, Download, Loader2 } from "lucide-react"

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

export default function StoragePage() {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [selected, setSelected] = useState<Bucket | null>(null)
  const [objects, setObjects] = useState<StorageObject[]>([])
  const [newBucket, setNewBucket] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "bucket" | "object"; id: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadBuckets() {
    const data = await api.get<Bucket[]>("/storage/buckets")
    setBuckets(data)
    if (selected && !data.find((b) => b.id === selected.id)) setSelected(null)
  }

  async function loadObjects(bucketId: string) {
    const data = await api.get<StorageObject[]>(`/storage/buckets/${bucketId}/objects`)
    setObjects(data)
  }

  useEffect(() => {
    loadBuckets().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selected) loadObjects(selected.id)
    else setObjects([])
  }, [selected])

  async function createBucket() {
    if (!newBucket.trim()) return
    try {
      await api.post("/storage/buckets", { name: newBucket.trim() })
      setNewBucket("")
      await loadBuckets()
      toast({ title: "Bucket created" })
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
    const form = new FormData()
    form.append("file", file)
    form.append("key", file.name)
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/storage/buckets/${selected.id}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(formatApiError(d.message, "Upload failed"))
    }
    await loadObjects(selected.id)
    await loadBuckets()
    toast({ title: "Uploaded", description: file.name })
  }

  return (
    <>
      <Header title="Object Storage" breadcrumbs={[{ label: "Storage" }]} />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl border bg-muted">
            <Database className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">S3-style storage</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Buckets and objects for assets, backups, and deploy artifacts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Buckets</CardTitle>
              <CardDescription>Isolated namespaces for your files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="my-bucket"
                  value={newBucket}
                  onChange={(e) => setNewBucket(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createBucket()}
                />
                <Button size="icon" variant="outline" onClick={createBucket}>
                  <FolderPlus className="w-4 h-4" />
                </Button>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </p>
              ) : buckets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No buckets yet.</p>
              ) : (
                <div className="space-y-1">
                  {buckets.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelected(b)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                        selected?.id === b.id ? "bg-muted font-medium" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{b.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {b.objectCount}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {selected ? selected.name : "Objects"}
                </CardTitle>
                <CardDescription>
                  {selected ? "Upload and manage files in this bucket." : "Select a bucket to view objects."}
                </CardDescription>
              </div>
              {selected && (
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        await uploadFile(f)
                      } catch (err) {
                        toast({
                          title: "Upload failed",
                          description: err instanceof Error ? err.message : "Error",
                          variant: "destructive",
                        })
                      }
                      e.target.value = ""
                    }}
                  />
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeleteTarget({ type: "bucket", id: selected.id })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Pick a bucket from the left.</p>
              ) : objects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Empty bucket — upload your first file.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {objects.map((obj) => (
                      <TableRow key={obj.id}>
                        <TableCell className="font-mono text-xs">{obj.key}</TableCell>
                        <TableCell className="text-muted-foreground">{formatBytes(obj.size)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{obj.mimeType || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                              <a
                                href={`${API_URL}/storage/buckets/${selected.id}/objects/${obj.id}/download`}
                                onClick={(e) => {
                                  e.preventDefault()
                                  const token = localStorage.getItem("token")
                                  fetch(
                                    `${API_URL}/storage/buckets/${selected.id}/objects/${obj.id}/download`,
                                    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                                  )
                                    .then((r) => r.blob())
                                    .then((blob) => {
                                      const url = URL.createObjectURL(blob)
                                      const a = document.createElement("a")
                                      a.href = url
                                      a.download = obj.key.split("/").pop() || "download"
                                      a.click()
                                      URL.revokeObjectURL(url)
                                    })
                                }}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteTarget({ type: "object", id: obj.id })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.type === "bucket" ? "Delete bucket?" : "Delete object?"}
        description="This action cannot be undone. All data in this bucket will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget || !selected) return
          try {
            if (deleteTarget.type === "bucket") {
              await api.delete(`/storage/buckets/${deleteTarget.id}`)
              setSelected(null)
              await loadBuckets()
            } else {
              await api.delete(`/storage/buckets/${selected.id}/objects/${deleteTarget.id}`)
              await loadObjects(selected.id)
              await loadBuckets()
            }
            toast({ title: "Deleted" })
          } catch (err) {
            toast({
              title: "Delete failed",
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
