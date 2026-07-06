"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { HardDrive, RotateCw, Trash2, Plus, RefreshCw, Search } from "lucide-react"

interface Backup {
  id: string
  fileName: string
  fileSize: number
  createdAt: string
  instance: { id: string; name: string }
}

interface Instance { id: string; name: string }

export default function BackupsPage() {
  return <Suspense><BackupsContent /></Suspense>
}

function BackupsContent() {
  const searchParams = useSearchParams()
  const filterInstance = searchParams.get("instance")
  const [backups, setBackups] = useState<Backup[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState(filterInstance || "")
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")

  async function fetchBackups() {
    try {
      const path = selectedInstance ? `/backups/${selectedInstance}` : "/backups"
      setBackups(await api.get<Backup[]>(path))
    } catch {}
  }

  useEffect(() => { api.get<Instance[]>("/instances").then(setInstances).catch(() => {}) }, [])
  useEffect(() => { fetchBackups() }, [selectedInstance])

  async function handleCreate() {
    if (!selectedInstance) return
    setCreating(true)
    try { await api.post(`/backups/${selectedInstance}`); fetchBackups() } catch {}
    setCreating(false)
  }

  async function handleRestore(id: string) {
    if (!confirm("Restore this snapshot? The instance will restart.")) return
    await api.post(`/backups/${id}/restore`); fetchBackups()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this snapshot?")) return
    await api.delete(`/backups/${id}`); fetchBackups()
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filtered = backups.filter((b) =>
    b.fileName.toLowerCase().includes(search.toLowerCase()) || b.instance.name.toLowerCase().includes(search.toLowerCase())
  )

  const inputCls = "flex h-8 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

  return (
    <>
      <Header title="Snapshots" breadcrumbs={[{ label: "Storage" }]} />
      <div className="p-6">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-medium">Snapshots ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} className={`${inputCls} w-auto`}>
                <option value="">All instances</option>
                {instances.map((inst) => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
              </select>
              <button onClick={fetchBackups} className="inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent h-8 w-8"><RefreshCw className="w-3.5 h-3.5" /></button>
              {selectedInstance && (
                <button onClick={handleCreate} disabled={creating} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 gap-1.5 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> {creating ? "Creating..." : "Create snapshot"}
                </button>
              )}
            </div>
          </div>
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter snapshots..." className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <HardDrive className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">{search ? "No snapshots match" : "No snapshots yet"}</p>
              {!search && selectedInstance && <button onClick={handleCreate} disabled={creating} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3">Create snapshot</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">File name</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Instance</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Size</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Created</th>
                    <th className="h-10 px-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium text-sm">{b.fileName}</td>
                      <td className="p-4 text-xs text-muted-foreground">{b.instance.name}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{formatSize(b.fileSize)}</td>
                      <td className="p-4 text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleRestore(b.id)} className="inline-flex items-center justify-center gap-1 rounded-md text-xs font-medium border bg-background hover:bg-accent h-7 px-2">
                            <RotateCw className="w-3 h-3" /> Restore
                          </button>
                          <button onClick={() => handleDelete(b.id)} className="inline-flex items-center justify-center rounded-md w-7 h-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
