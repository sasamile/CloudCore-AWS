"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { formatApiError } from "@/lib/format-api-error"
import { useToast } from "@/hooks/use-toast"
import { TableRowsSkeleton } from "@/components/skeletons/page-skeletons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Globe,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"

interface Domain {
  id: string
  domain: string
  targetPort: number
  sslEnabled: boolean
  instance: { id: string; name: string }
  createdAt: string
  routeActive?: boolean
  clientDns?: { type: string; name: string; target: string } | null
}

interface Instance {
  id: string
  name: string
  status: string
}

interface TunnelStatus {
  mode: string
  baseDomain: string | null
  cnameTarget: string | null
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-primary transition-colors"
    >
      <span className="break-all">{value}</span>
      {copied ? <Check className="w-3 h-3 text-green-600 shrink-0" /> : <Copy className="w-3 h-3 shrink-0 opacity-50" />}
    </button>
  )
}

function DomainStatus({ active, isTunnel }: { active?: boolean; isTunnel: boolean }) {
  if (!isTunnel) {
    return <Badge variant="secondary">Configurar DNS</Badge>
  }
  if (active) {
    return (
      <Badge variant="success" className="gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Activo
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 text-amber-700 dark:text-amber-400 border-amber-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Pendiente DNS
    </Badge>
  )
}

export default function DomainsPage() {
  const { toast } = useToast()
  const [domains, setDomains] = useState<Domain[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [domainName, setDomainName] = useState("")
  const [instanceId, setInstanceId] = useState("")
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const isTunnel = tunnel?.mode === "tunnel"
  const cnameTarget = tunnel?.cnameTarget

  async function fetchDomains() {
    try {
      setDomains(await api.get<Domain[]>("/domains"))
    } catch {}
  }

  async function fetchAll() {
    await Promise.all([
      fetchDomains(),
      api.get<Instance[]>("/instances").then(setInstances).catch(() => {}),
      api.get<TunnelStatus>("/domains/tunnel-status").then(setTunnel).catch(() => {}),
    ])
    setPageLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/domains", { domain: domainName, instanceId })
      setShowForm(false)
      setDomainName("")
      setInstanceId("")
      await fetchDomains()
      toast({
        title: "Dominio agregado",
        description: isTunnel
          ? "Configura el registro DNS que aparece abajo para activarlo."
          : "Dominio guardado correctamente.",
      })
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

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este dominio?")) return
    try {
      await api.delete(`/domains/${id}`)
      if (expanded === id) setExpanded(null)
      fetchDomains()
      toast({ title: "Dominio eliminado" })
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    }
  }

  async function handleRetrySync() {
    setSyncing(true)
    try {
      const result = await api.post<{ cloudflareSynced: boolean; cloudflareError?: string }>(
        "/domains/sync-tunnel"
      )
      await fetchDomains()
      if (result.cloudflareSynced) {
        toast({ title: "Rutas actualizadas", description: "Espera 1–2 minutos y prueba tu dominio." })
      } else {
        toast({
          title: "No se pudo sincronizar",
          description: result.cloudflareError ?? "Revisa la configuración del túnel.",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: formatApiError(err instanceof Error ? err.message : undefined),
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const filtered = domains.filter((d) => d.domain.toLowerCase().includes(search.toLowerCase()))
  const pendingCount = domains.filter((d) => isTunnel && d.routeActive === false).length

  return (
    <>
      <Header title="Domains" breadcrumbs={[{ label: "Network" }]} />
      <div className="w-full px-4 py-6 sm:px-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Domains</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isTunnel
                ? "Agrega tu dominio, conéctalo a una instancia y configura el DNS."
                : "Apunta tus dominios a las instancias de tu servidor."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchAll}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5" /> Agregar dominio
            </Button>
          </div>
        </div>

        {isTunnel && tunnel?.baseDomain && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Subdominio automático: </span>
            <code className="font-mono text-xs">
              {"{instancia}."}
              {tunnel.baseDomain}
            </code>
            <span className="text-muted-foreground"> — se activa al iniciar la instancia, sin configurar DNS.</span>
          </div>
        )}

        {showForm && (
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="text-sm font-medium">Agregar dominio</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dominio</label>
                  <Input
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                    placeholder={isTunnel ? "app.tudominio.com" : "app.example.com"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instancia</label>
                  <select
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    required
                  >
                    <option value="">Seleccionar instancia...</option>
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {loading ? "Guardando..." : "Agregar"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-lg border">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar dominios..."
                className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {isTunnel && pendingCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleRetrySync} disabled={syncing}>
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Reintentar ({pendingCount})
              </Button>
            )}
          </div>

          {pageLoading ? (
            <TableRowsSkeleton rows={4} cols={4} />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No hay dominios que coincidan" : "Aún no tienes dominios"}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setShowForm(true)}>
                  Agregar dominio
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((d) => {
                const isExpanded = expanded === d.id
                const dns = d.clientDns ?? (cnameTarget ? { type: "CNAME", name: d.domain.split(".")[0], target: cnameTarget } : null)
                const showDns = isTunnel && d.routeActive === false && dns

                return (
                  <div key={d.id}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={`https://${d.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-sm inline-flex items-center gap-1 hover:underline"
                          >
                            {d.domain}
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </a>
                          <DomainStatus active={d.routeActive} isTunnel={!!isTunnel} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          → {d.instance.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {showDns && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setExpanded(isExpanded ? null : d.id)}
                          >
                            DNS
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(d.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && showDns && dns && (
                      <div className="px-4 pb-4">
                        <div className="rounded-md border bg-muted/30 p-4 space-y-3 text-sm">
                          <p className="text-muted-foreground">
                            Agrega este registro en el DNS de tu dominio (Cloudflare, Hostinger, etc.):
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Tipo</p>
                              <CopyValue value={dns.type} />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Nombre</p>
                              <CopyValue value={dns.name} />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Destino</p>
                              <CopyValue value={dns.target} />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            La propagación puede tardar 1–5 minutos. HTTPS se activa automáticamente.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
