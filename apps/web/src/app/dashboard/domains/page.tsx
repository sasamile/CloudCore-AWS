"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { Globe, Shield, Trash2, Plus, Search, RefreshCw, Info } from "lucide-react"

interface Domain {
  id: string
  domain: string
  targetPort: number
  sslEnabled: boolean
  instance: { id: string; name: string }
  createdAt: string
}

interface Instance {
  id: string
  name: string
  status: string
  internalPort: number | null
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [showForm, setShowForm] = useState(false)
  const [domainName, setDomainName] = useState("")
  const [targetPort, setTargetPort] = useState(3000)
  const [instanceId, setInstanceId] = useState("")
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  async function fetchDomains() { try { setDomains(await api.get<Domain[]>("/domains")) } catch {} }
  async function fetchInstances() { try { setInstances(await api.get<Instance[]>("/instances")) } catch {} }

  useEffect(() => { fetchDomains(); fetchInstances() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/domains", { domain: domainName, targetPort, instanceId })
      setShowForm(false); setDomainName(""); setTargetPort(3000); setInstanceId("")
      fetchDomains()
    } catch {}
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this domain?")) return
    await api.delete(`/domains/${id}`)
    fetchDomains()
  }

  async function handleEnableSsl(id: string) {
    await api.post(`/domains/${id}/ssl`)
    fetchDomains()
  }

  const filtered = domains.filter((d) => d.domain.toLowerCase().includes(search.toLowerCase()))
  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

  return (
    <>
      <Header title="Domains" breadcrumbs={[{ label: "Network" }]} />
      <div className="p-6 space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="w-4 h-4" /> DNS Configuration
          </div>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>1. Create an <code className="font-mono text-foreground bg-muted px-1 rounded">A</code> record in your DNS provider pointing to your server&apos;s public IP.</p>
            <p>2. On your server, create an Nginx server block for each domain:</p>
            <pre className="bg-background border rounded-md p-3 font-mono text-xs overflow-x-auto">{`server {
    server_name app.example.com;
    location / {
        proxy_pass http://localhost:<HOST_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}`}</pre>
            <p>Replace <code className="font-mono text-foreground bg-muted px-1 rounded">&lt;HOST_PORT&gt;</code> with the instance&apos;s host port (e.g. 10003). Then run <code className="font-mono text-foreground bg-muted px-1 rounded">sudo nginx -t && sudo systemctl reload nginx</code>.</p>
          </div>
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
                  <input type="text" value={domainName} onChange={(e) => setDomainName(e.target.value)} className={inputCls} placeholder="app.example.com" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target port</label>
                  <input type="number" value={targetPort} onChange={(e) => setTargetPort(Number(e.target.value))} className={inputCls} min={1} max={65535} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instance</label>
                  <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className={inputCls} required>
                    <option value="">Select instance...</option>
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name} ({inst.status}) {inst.internalPort ? `— port ${inst.internalPort}` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 disabled:opacity-50">
                  {loading ? "Saving..." : "Add domain"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="inline-flex items-center justify-center rounded-md text-sm font-medium border bg-background hover:bg-accent h-8 px-3">
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
              <button onClick={fetchDomains} className="inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent h-8 w-8"><RefreshCw className="w-3.5 h-3.5" /></button>
              <button onClick={() => setShowForm(true)} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add domain
              </button>
            </div>
          </div>
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter domains..." className="flex h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">{search ? "No domains match your filter" : "No domains configured yet"}</p>
              {!search && <button onClick={() => setShowForm(true)} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3">Add domain</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Domain</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Instance</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Port</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">SSL</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Created</th>
                    <th className="h-10 px-4 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-mono text-xs font-medium">{d.domain}</td>
                      <td className="p-4 text-xs">{d.instance.name}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{d.targetPort}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${d.sslEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                          <Shield className="w-3 h-3" /> {d.sslEnabled ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          {!d.sslEnabled && (
                            <button onClick={() => handleEnableSsl(d.id)} className="inline-flex items-center justify-center rounded-md text-xs font-medium border bg-background hover:bg-accent h-7 px-2">Enable SSL</button>
                          )}
                          <button onClick={() => handleDelete(d.id)} className="inline-flex items-center justify-center rounded-md w-7 h-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
