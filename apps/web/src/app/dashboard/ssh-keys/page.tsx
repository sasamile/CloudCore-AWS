"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Key, Plus, Trash2, Download, RefreshCw, Search, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
          <Alert variant="warning">
            <AlertTitle>Key pair creado exitosamente</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>Descarga el archivo .pem ahora. No podrás descargarlo de nuevo.</p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => downloadKey(createdKey.name, createdKey.privateKey)}>
                  <Download className="w-3.5 h-3.5" /> Descargar .pem
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(createdKey.privateKey)}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiado" : "Copiar clave"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)} className="ml-auto">
                  Cerrar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Create key pair</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="keyName">Key pair name</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="my-key-pair"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={creating}>
                    {creating ? "Creating..." : "Create key pair"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4 space-y-0">
            <CardTitle className="text-sm font-medium">Key Pairs ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={fetchKeys} title="Actualizar">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    if (!confirm(`Delete ${selected.size} key pair(s)?`)) return
                    selected.forEach((id) => handleDelete(id))
                  }}
                >
                  Delete
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5" /> Create key pair
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="px-4 py-3 border-y bg-muted/30">
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter key pairs..."
                  className="h-8 pl-8 text-xs"
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
                  <Button size="sm" onClick={() => setShowCreate(true)}>Create key pair</Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(key.id)}
                          onChange={() => toggleSelect(key.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{key.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{key.fingerprint}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(key.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
