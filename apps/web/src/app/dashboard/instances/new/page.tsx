"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { downloadPem } from "@/lib/instance"
import { ArrowLeft, Key, Download, Plus } from "lucide-react"
import Link from "next/link"

const PRESETS = [
  { name: "z1.micro", memory: 256, cpu: 0.25, desc: "Testing & lightweight apps" },
  { name: "z1.small", memory: 512, cpu: 0.5, desc: "Next.js or NestJS production" },
  { name: "z1.medium", memory: 1024, cpu: 1.0, desc: "Higher workloads" },
]

interface KeyPair { id: string; name: string }

type KeyMode = "none" | "existing" | "create"

export default function NewInstancePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [memoryLimit, setMemoryLimit] = useState(512)
  const [cpuLimit, setCpuLimit] = useState(0.5)
  const [selectedPreset, setSelectedPreset] = useState("z1.small")
  const [keyMode, setKeyMode] = useState<KeyMode>("create")
  const [sshKeyId, setSshKeyId] = useState("")
  const [newKeyName, setNewKeyName] = useState("")
  const [sshKeys, setSshKeys] = useState<KeyPair[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    api.get<KeyPair[]>("/ssh-keys").then(setSshKeys).catch(() => {})
  }, [])

  useEffect(() => {
    if (keyMode === "create" && name && !newKeyName) {
      setNewKeyName(name.replace(/[^a-zA-Z0-9-_]/g, "-"))
    }
  }, [name, keyMode, newKeyName])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let keyId = sshKeyId
      let keyName = ""

      if (keyMode === "create") {
        const keyNameTrim = newKeyName.trim() || name
        const keyData = await api.post<KeyPair & { privateKey: string }>("/ssh-keys", { name: keyNameTrim })
        keyId = keyData.id
        keyName = keyNameTrim
        downloadPem(keyNameTrim, keyData.privateKey)
      } else if (keyMode === "existing") {
        keyName = sshKeys.find((k) => k.id === sshKeyId)?.name || ""
      }

      const instance = await api.post<{ id: string }>("/instances", {
        name,
        memoryLimit,
        cpuLimit,
        ...(keyId ? { sshKeyId: keyId } : {}),
      })

      const qs = keyName ? `?new=1&key=${encodeURIComponent(keyName)}` : "?new=1"
      router.push(`/dashboard/instances/${instance.id}${qs}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating instance")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header
        title="Launch instance"
        breadcrumbs={[
          { label: "Compute", href: "/dashboard/instances" },
          { label: "Instances", href: "/dashboard/instances" },
        ]}
      />
      <div className="p-6 max-w-2xl space-y-6">
        <Link href="/dashboard/instances" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to instances
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Instance name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="my-next-server"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium leading-none">Instance type</label>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-9 px-4 text-left w-8"></th>
                    <th className="h-9 px-4 text-left font-medium text-muted-foreground">Type</th>
                    <th className="h-9 px-4 text-left font-medium text-muted-foreground">vCPU</th>
                    <th className="h-9 px-4 text-left font-medium text-muted-foreground">Memory</th>
                    <th className="h-9 px-4 text-left font-medium text-muted-foreground">Use case</th>
                  </tr>
                </thead>
                <tbody>
                  {PRESETS.map((p) => (
                    <tr
                      key={p.name}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${selectedPreset === p.name ? "bg-muted/50" : "hover:bg-muted/30"}`}
                      onClick={() => { setSelectedPreset(p.name); setMemoryLimit(p.memory); setCpuLimit(p.cpu) }}
                    >
                      <td className="px-4 py-2.5">
                        <input type="radio" name="preset" checked={selectedPreset === p.name} readOnly className="accent-foreground" />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium">{p.name}</td>
                      <td className="px-4 py-2.5">{p.cpu}</td>
                      <td className="px-4 py-2.5">{p.memory} MB</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium leading-none flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Key pair (SSH)
            </label>
            <div className="rounded-lg border overflow-hidden">
              {([
                { mode: "create" as KeyMode, label: "Crear nuevo key pair", desc: "Genera y descarga el .pem automáticamente" },
                { mode: "existing" as KeyMode, label: "Usar key pair existente", desc: "Selecciona uno ya creado" },
                { mode: "none" as KeyMode, label: "Sin SSH (solo terminal web)", desc: "Acceso solo desde el navegador" },
              ]).map((opt) => (
                <label
                  key={opt.mode}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b last:border-0 transition-colors ${keyMode === opt.mode ? "bg-muted/50" : "hover:bg-muted/30"}`}
                >
                  <input
                    type="radio"
                    name="keyMode"
                    checked={keyMode === opt.mode}
                    onChange={() => setKeyMode(opt.mode)}
                    className="mt-1 accent-foreground"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {keyMode === "create" && (
              <div className="space-y-1.5 pl-1">
                <label className="text-xs text-muted-foreground">Nombre del key pair</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={name || "my-key-pair"}
                  required
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  Se descargará <code className="font-mono">{newKeyName || name || "key"}.pem</code> a tu carpeta de descargas. Guárdalo en <code className="font-mono">~/.ssh/</code>
                </p>
              </div>
            )}

            {keyMode === "existing" && (
              <div className="space-y-1.5 pl-1">
                {sshKeys.length > 0 ? (
                  <select
                    value={sshKeyId}
                    onChange={(e) => setSshKeyId(e.target.value)}
                    required
                    className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar key pair...</option>
                    {sshKeys.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No tienes key pairs.{" "}
                    <button type="button" onClick={() => setKeyMode("create")} className="underline inline-flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Crear uno
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Summary:</span> Ubuntu 22.04 + Node.js 20 &middot; {selectedPreset || "Custom"} &middot; {memoryLimit} MB &middot; {cpuLimit} vCPU
              {keyMode !== "none" && <> &middot; SSH habilitado</>}
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => router.back()} className="inline-flex items-center justify-center rounded-md text-sm font-medium border bg-background hover:bg-accent h-9 px-4 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 disabled:opacity-50">
              {loading ? "Launching..." : "Launch instance"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
