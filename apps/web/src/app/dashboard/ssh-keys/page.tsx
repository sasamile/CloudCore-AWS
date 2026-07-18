"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { ErrorState } from "@/components/layout/error-state"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { downloadPem } from "@/lib/instance"
import { TableRowsSkeleton } from "@/components/skeletons/page-skeletons"
import { Key, Plus, Trash2, Download, RefreshCw, Search, Copy, Check, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  canDownload: boolean
}

export default function SSHKeysPage() {
  const [keys, setKeys] = useState<KeyPair[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
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

  async function handleRename(id: string, currentName: string) {
    const newName = prompt("Nuevo nombre del key pair:", currentName)
    if (!newName || newName.trim() === currentName) return
    try {
      await api.patch(`/ssh-keys/${id}`, { name: newName.trim() })
      fetchKeys()
    } catch (err) {
      setError(formatApiError(err instanceof Error ? err.message : undefined))
    }
  }

  async function handleDownload(id: string, name: string, canDownload: boolean) {
    if (!canDownload) {
      setError("Esta clave es antigua y no tiene copia guardada. Crea un key pair nuevo.")
      return
    }
    setDownloading(id)
    setError("")
    try {
      const data = await api.get<{ name: string; privateKey: string }>(`/ssh-keys/${id}/download`)
      downloadPem(data.name, data.privateKey)
    } catch (err) {
      setError(formatApiError(err instanceof Error ? err.message : undefined))
    } finally {
      setDownloading(null)
    }
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
        breadcrumbs={[{ label: "Compute", href: "/dashboard/instances" }]}
      />
      <PageShell maxWidth="5xl">
        <PageHeader
          title="Key Pairs"
          description="Administra pares de claves SSH para conectar a tus instancias."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchKeys} title="Actualizar">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    if (!confirm(`¿Eliminar ${selected.size} key pair(s)?`)) return
                    selected.forEach((id) => handleDelete(id))
                  }}
                >
                  Eliminar
                </Button>
              )}
              <Button className="h-9" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5" /> Crear key pair
              </Button>
            </div>
          }
        />

        {createdKey && (
          <Alert className="rounded-2xl border-border">
            <AlertTitle>Key pair creado</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>Descarga el archivo .pem ahora. También puedes volver a descargarlo desde la lista.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button className="h-9" onClick={() => downloadPem(createdKey.name, createdKey.privateKey)}>
                  <Download className="w-3.5 h-3.5" /> Descargar .pem
                </Button>
                <Button className="h-9" variant="outline" onClick={() => copyToClipboard(createdKey.privateKey)}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiado" : "Copiar clave"}
                </Button>
                <Button className="h-9" variant="ghost" onClick={() => setCreatedKey(null)}>
                  Cerrar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showCreate && (
          <div className="rounded-2xl border border-border">
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-sm font-semibold">Crear key pair</h3>
              <p className="text-sm text-muted-foreground mt-1">Se generará un par RSA 2048 para conectar por SSH.</p>
            </div>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="keyName">Nombre</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="mi-key-pair"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="h-9" disabled={creating}>
                    {creating ? "Creando..." : "Crear key pair"}
                  </Button>
                  <Button type="button" className="h-9" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {error && !loading ? (
          <ErrorState message={error} onRetry={fetchKeys} />
        ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar key pairs..."
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <TableRowsSkeleton rows={5} cols={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Key}
              title={search ? "No hay key pairs que coincidan" : "Aún no tienes key pairs"}
              description={search ? "Prueba con otro término de búsqueda." : "Crea un key pair para conectar por SSH a tus instancias."}
              action={
                !search ? (
                  <Button className="h-9" onClick={() => setShowCreate(true)}>Crear key pair</Button>
                ) : undefined
              }
              className="border-0 rounded-none bg-transparent"
            />
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Renombrar"
                          onClick={() => handleRename(key.id, key.name)}
                          className="h-9 w-9"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={key.canDownload ? "Descargar .pem" : "Sin copia guardada"}
                          disabled={!key.canDownload || downloading === key.id}
                          onClick={() => handleDownload(key.id, key.name, key.canDownload)}
                          className="h-9 w-9"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(key.id)}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
        </div>
        )}
      </PageShell>
    </>
  )
}
