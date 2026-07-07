"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Globe, Shield, Trash2, Plus, Search, RefreshCw, Info, CheckCircle2, ExternalLink } from "lucide-react"

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
  internalPort: number | null
}

interface TunnelStatus {
  mode: string
  baseDomain: string | null
  tunnelName: string | null
  cnameTarget: string | null
  autoDns: boolean
  autoReload: boolean
  clientSteps: string[]
  dnsExample: { type: string; name: string; target: string; note: string } | null
}

export default function DomainsPage() {
  const { toast } = useToast()
  const [domains, setDomains] = useState<Domain[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [domainName, setDomainName] = useState("")
  const [targetPort, setTargetPort] = useState(3000)
  const [instanceId, setInstanceId] = useState("")
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  async function fetchDomains() {
    try {
      setDomains(await api.get<Domain[]>("/domains"))
    } catch {}
  }

  async function fetchInstances() {
    try {
      setInstances(await api.get<Instance[]>("/instances"))
    } catch {}
  }

  async function fetchTunnel() {
    try {
      setTunnel(await api.get<TunnelStatus>("/domains/tunnel-status"))
    } catch {}
  }

  useEffect(() => {
    fetchDomains()
    fetchInstances()
    fetchTunnel()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await api.post<
        Domain & {
          tunnelSync?: { dnsRegistered: string[]; restarted: boolean; cloudflareSynced: boolean }
        }
      >("/domains", { domain: domainName, targetPort, instanceId })
      setShowForm(false)
      setDomainName("")
      setTargetPort(3000)
      setInstanceId("")
      fetchDomains()

      const sync = result.tunnelSync
      if (sync?.cloudflareSynced) {
        toast({
          title: "Dominio publicado",
          description: `Ruta enviada a Cloudflare. En 1–2 min abre https://${domainName}`,
        })
      } else if (sync?.restarted) {
        toast({
          title: "Dominio guardado",
          description: "Ruta actualizada y túnel reiniciado.",
        })
      } else if (tunnel?.mode === "tunnel") {
        toast({
          title: "Dominio guardado",
          description: `CNAME en tu DNS → ${tunnel.cnameTarget ?? "el túnel"}. Si sigue en 404, el admin debe activar CLOUDFLARE_API_TOKEN.`,
        })
      }
    } catch {
      toast({ title: "Error", description: "No se pudo crear el dominio", variant: "destructive" })
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este dominio?")) return
    await api.delete(`/domains/${id}`)
    fetchDomains()
  }

  async function handleEnableSsl(id: string) {
    await api.post(`/domains/${id}/ssl`)
    fetchDomains()
  }

  const filtered = domains.filter((d) => d.domain.toLowerCase().includes(search.toLowerCase()))
  const inputCls =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  const isTunnel = tunnel?.mode === "tunnel"

  return (
    <>
      <Header title="Domains" breadcrumbs={[{ label: "Network" }]} />
      <div className="p-6 space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="w-4 h-4" />
            {isTunnel ? "Dominio propio (modo cliente)" : "DNS Configuration"}
          </div>

          {isTunnel ? (
            <div className="text-xs text-muted-foreground space-y-3">
              <p className="text-foreground font-medium">Solo 1 paso en ZynCloud — sin acceso al servidor:</p>
              <ol className="list-decimal list-inside space-y-1">
                {(tunnel?.clientSteps ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <div className="rounded-md border bg-background p-3 space-y-2">
                <p className="font-medium text-foreground">Ejemplo: prueba.vekino.site (dominio del cliente)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-muted-foreground">ZynCloud → Domain</span>
                    <div className="text-foreground">prueba.vekino.site</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Instance</span>
                    <div className="text-foreground">Prueba</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Port</span>
                    <div className="text-foreground">3000</div>
                  </div>
                </div>
                {tunnel?.dnsExample && (
                  <div className="mt-2 p-2 rounded bg-muted/50 font-mono text-[11px] space-y-1">
                    <p className="font-sans font-medium text-foreground text-xs">
                      En el DNS del cliente (Cloudflare / Hostinger):
                    </p>
                    <div>
                      Type: <strong>{tunnel.dnsExample.type}</strong> (no uses A)
                    </div>
                    <div>
                      Name: <strong>{tunnel.dnsExample.name}</strong>
                    </div>
                    <div>
                      Target: <strong className="break-all">{tunnel.cnameTarget ?? tunnel.dnsExample.target}</strong>
                    </div>
                    <p className="font-sans text-muted-foreground">{tunnel.dnsExample.note}</p>
                    <p className="font-sans text-amber-600 font-medium text-xs mt-1">
                      Si tienes &quot;Tunnel → zyncloud&quot; en tu Cloudflare, bórralo. Ese túnel es de otra
                      cuenta y da error 404.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-[11px]">
                {tunnel?.autoReload && (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" /> Ruta del túnel se actualiza sola
                  </span>
                )}
                {tunnel?.baseDomain && (
                  <span className="text-muted-foreground">
                    Dominios *.{tunnel.baseDomain} en tu cuenta CF: DNS automático
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                1. Crea un registro <code className="font-mono bg-muted px-1 rounded">A</code> apuntando a la IP
                pública del servidor.
              </p>
              <p>2. Configura Nginx en el servidor para cada dominio.</p>
            </div>
          )}
        </div>

        {showForm && (
          <div className="rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-medium">Add domain</h3>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Domain</label>
                  <input
                    type="text"
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                    className={inputCls}
                    placeholder={isTunnel ? "prueba.vekino.site" : "app.example.com"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target port</label>
                  <input
                    type="number"
                    value={targetPort}
                    onChange={(e) => setTargetPort(Number(e.target.value))}
                    className={inputCls}
                    min={1}
                    max={65535}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instance</label>
                  <select
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">Select instance...</option>
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.status}){inst.internalPort ? ` — port ${inst.internalPort}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Add domain"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border bg-background hover:bg-accent h-8 px-3"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-medium">Domains ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchDomains()
                  fetchTunnel()
                }}
                className="inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent h-8 w-8"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add domain
              </button>
            </div>
          </div>
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter domains..."
                className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No domains match your filter" : "No domains configured yet"}
              </p>
              {!search && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3"
                >
                  Add domain
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Domain</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Instance</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Port</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Ruta</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">SSL</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Created</th>
                    <th className="h-10 px-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <a
                          href={`https://${d.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs font-medium inline-flex items-center gap-1 hover:underline"
                        >
                          {d.domain}
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </a>
                      </td>
                      <td className="p-4 text-xs">{d.instance.name}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{d.targetPort}</td>
                      <td className="p-4">
                        {d.routeActive === undefined ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : d.routeActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 className="w-3 h-3" /> Servidor OK
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600">Pendiente</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${d.sslEnabled ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          <Shield className="w-3 h-3" /> {d.sslEnabled ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          {!d.sslEnabled && (
                            <button
                              onClick={() => handleEnableSsl(d.id)}
                              className="inline-flex items-center justify-center rounded-md text-xs font-medium border bg-background hover:bg-accent h-7 px-2"
                            >
                              Enable SSL
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="inline-flex items-center justify-center rounded-md w-7 h-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
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
