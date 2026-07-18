"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { api } from "@/lib/api"
import { downloadPem } from "@/lib/instance"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { ArrowLeft, Key, Download, Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

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

      toast({ title: "Instance launched", description: `${name} is being created.` })
      const qs = keyName ? `?new=1&key=${encodeURIComponent(keyName)}` : "?new=1"
      router.push(`/dashboard/instances/${instance.id}${qs}`)
    } catch (err: unknown) {
      const msg = formatApiError(err instanceof Error ? err.message : undefined, "Error creating instance")
      setError(msg)
      toast({ title: "Launch failed", description: msg, variant: "destructive" })
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
      <PageShell maxWidth="4xl">
        <Button variant="ghost" asChild className="-ml-2 h-9 text-muted-foreground">
          <Link href="/dashboard/instances">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to instances
          </Link>
        </Button>

        <PageHeader
          title="New compute instance"
          description="Ubuntu 22.04 with Node.js 20. Pick a size and optional SSH access."
        />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-border">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold">General</h3>
              <p className="text-sm text-muted-foreground mt-1">Name your instance for easy identification.</p>
            </div>
            <div className="px-6 pb-6">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="name">Instance name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-next-server"
                  required
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold">Instance type</h3>
              <p className="text-sm text-muted-foreground mt-1">CPU and memory for your workload.</p>
            </div>
            <div className="divide-y border-t border-border">
                {PRESETS.map((p) => (
                  <label
                    key={p.name}
                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors ${
                      selectedPreset === p.name ? "bg-muted/60" : "hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="preset"
                      checked={selectedPreset === p.name}
                      onChange={() => {
                        setSelectedPreset(p.name)
                        setMemoryLimit(p.memory)
                        setCpuLimit(p.cpu)
                      }}
                      className="accent-foreground"
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 items-center">
                      <span className="font-mono font-medium text-sm">{p.name}</span>
                      <span className="text-sm text-muted-foreground">{p.cpu} vCPU</span>
                      <span className="text-sm text-muted-foreground">{p.memory} MB</span>
                      <span className="text-xs text-muted-foreground truncate">{p.desc}</span>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Key className="w-4 h-4" /> Key pair (SSH)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">How you will connect to the instance.</p>
            </div>
            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                {([
                  { mode: "create" as KeyMode, label: "Create new key pair", desc: "Generate and download .pem automatically" },
                  { mode: "existing" as KeyMode, label: "Use existing key pair", desc: "Select one you already created" },
                  { mode: "none" as KeyMode, label: "No SSH (web terminal only)", desc: "Browser access only" },
                ]).map((opt) => (
                  <label
                    key={opt.mode}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                      keyMode === opt.mode ? "border-foreground/30 bg-muted/50" : "hover:bg-muted/30"
                    }`}
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
                <div className="space-y-2 pl-1 max-w-md">
                  <Label htmlFor="keyName">Key pair name</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder={name || "my-key-pair"}
                    required
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    Downloads <code className="font-mono">{newKeyName || name || "key"}.pem</code> — save to <code className="font-mono">~/.ssh/</code>
                  </p>
                </div>
              )}

              {keyMode === "existing" && (
                <div className="pl-1 max-w-md">
                  {sshKeys.length > 0 ? (
                    <select
                      value={sshKeyId}
                      onChange={(e) => setSshKeyId(e.target.value)}
                      required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Select key pair...</option>
                      {sshKeys.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No key pairs yet.{" "}
                      <button type="button" onClick={() => setKeyMode("create")} className="underline inline-flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Create one
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30">
            <div className="px-6 py-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Summary</span>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <Badge variant="secondary">Ubuntu 22.04</Badge>
              <Badge variant="secondary">Node.js 20</Badge>
              <Badge variant="outline">{selectedPreset}</Badge>
              <Badge variant="outline">{memoryLimit} MB</Badge>
              <Badge variant="outline">{cpuLimit} vCPU</Badge>
              {keyMode !== "none" && <Badge variant="outline">SSH</Badge>}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" className="h-9" disabled={loading}>
              {loading ? "Launching..." : "Launch instance"}
            </Button>
          </div>
        </form>
      </PageShell>
    </>
  )
}
