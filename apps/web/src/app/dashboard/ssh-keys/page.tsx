"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Key, Plus, Trash2, Download, RefreshCw, Search, Copy, Check } from "lucide-react"

interface KeyPair {
  id: string
  name: string
  fingerprint: string
  createdAt: string
}

export default function SSHKeysPage() {
  const [keys, setKeys] = useState<KeyPair[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [createdKey, setCreatedKey] = useState<{ name: string; privateKey: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    setLoading(true)
    setError("")
    try {
      const data = await api.get<KeyPair[]>("/ssh-keys")
      setKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar key pairs")
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError("")
    try {
      const data = await api.post<KeyPair & { privateKey: string }>("/ssh-keys", { name: newKeyName })
      setCreatedKey({ name: newKeyName, privateKey: data.privateKey })
      setNewKeyName("")
      setShowCreate(false)
      fetchKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear key pair")
    }
    setCreating(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este key pair permanentemente?")) return
    try {
      await api.delete(`/ssh-keys/${id}`)
      fetchKeys()
      selected.delete(id)
      setSelected(new Set(selected))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar")
    }
  }

  function downloadKey(name: string, content: string) {
    const blob = new Blob([content], { type: "application/x-pem-file" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = keys.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((k) => k.id)))
  }

  return (
    <>
      <Header
        title="Key Pairs"
        breadcrumbs={[{ label: "EC2", href: "/dashboard/instances" }, { label: "Network & Security" }]}
      />
      <div className="p-6 space-y-4">
        {createdKey && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-sm">Key pair creado exitosamente</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Descarga el archivo .pem ahora. No podrás descargarlo de nuevo.
                </p>
              </div>
              <button onClick={() => setCreatedKey(null)} className="text-muted-foreground hover:text-foreground text-sm">
                Cerrar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadKey(createdKey.name, createdKey.privateKey)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" /> Descargar .pem
              </button>
              <button
                onClick={() => copyToClipboard(createdKey.privateKey)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background hover:bg-accent h-8 px-3 text-xs font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar clave"}
              </button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="rounded-lg border p-5">
            <h3 className="font-semibold text-sm mb-4">Create key pair</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Key pair name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="my-key-pair"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={creating} className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4 text-xs font-medium disabled:opacity-50">
                  {creating ? "Creating..." : "Create key pair"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="inline-flex items-center rounded-md border bg-background hover:bg-accent h-8 px-4 text-xs font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Key Pairs ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              <button onClick={fetchKeys} title="Actualizar" className="inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent h-8 w-8">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => {
                    if (!confirm(`Delete ${selected.size} key pair(s)?`)) return
                    selected.forEach((id) => handleDelete(id))
                  }}
                  className="inline-flex items-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 h-8 px-3 text-xs font-medium"
                >
                  Delete
                </button>
              )}
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> Create key pair
              </button>
            </div>
          </div>

          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter key pairs..."
                className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading key pairs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No key pairs match your filter" : "No key pairs yet"}
              </p>
              {!search && (
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs font-medium">
                  Create key pair
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left w-8">
                      <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Name</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Fingerprint</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Created</th>
                    <th className="h-10 px-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((key) => (
                    <tr key={key.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-4">
                        <input type="checkbox" checked={selected.has(key.id)} onChange={() => toggleSelect(key.id)} className="rounded" />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{key.name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{key.fingerprint}</td>
                      <td className="p-4 text-xs text-muted-foreground">{new Date(key.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end">
                          <button onClick={() => handleDelete(key.id)} title="Eliminar key pair" className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
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
