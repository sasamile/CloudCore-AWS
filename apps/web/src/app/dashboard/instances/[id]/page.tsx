"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import type { InstanceNetworking } from "@/lib/instance"
import {
  Play, Square, RotateCw, Terminal, Activity, Globe,
  Trash2, Rocket, ExternalLink, HardDrive, Copy, Check,
  Key, Server, Network, Info,
} from "lucide-react"

function CopyField({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      {label && <p className="text-xs text-muted-foreground mb-0.5">{label}</p>}
      <div className="flex items-center gap-1.5">
        <p className="font-mono text-xs break-all">{value}</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          title="Copiar"
        >
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  )
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  )
}

export default function InstanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = searchParams.get("new") === "1"
  const newKeyName = searchParams.get("key")
  const [instance, setInstance] = useState<InstanceNetworking | null>(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ url: string; message: string } | null>(null)

  async function fetchInstance() {
    try {
      const data = await api.get<InstanceNetworking>(`/instances/${params.id}`)
      setInstance(data)
    } catch {
      router.push("/dashboard/instances")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInstance() }, [params.id])

  async function handleAction(action: "start" | "stop" | "restart" | "delete") {
    if (!instance) return
    if (action === "delete" && !confirm("¿Eliminar esta instancia permanentemente?")) return
    try {
      if (action === "delete") {
        await api.delete(`/instances/${instance.id}`)
        router.push("/dashboard/instances")
        return
      }
      await api.post(`/instances/${instance.id}/${action}`)
      fetchInstance()
    } catch {}
  }

  if (loading) {
    return (
      <>
        <Header title="Instance" breadcrumbs={[{ label: "Compute" }]} />
        <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
      </>
    )
  }
  if (!instance) return null

  const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium h-8 px-3 transition-colors"
  const isRunning = instance.status === "running"
  const publicIp = instance.publicHost !== "localhost" ? instance.publicHost : null

  return (
    <>
      <Header
        title={`Resumen de instancia — ${instance.name}`}
        breadcrumbs={[
          { label: "Compute", href: "/dashboard/instances" },
          { label: "Instances", href: "/dashboard/instances" },
        ]}
      />
      <div className="p-6 space-y-5 max-w-6xl">
        {isNew && instance.sshCommand && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800 dark:text-green-400">Instancia creada — copia y pega para conectarte por SSH:</p>
            <CopyField label="" value={instance.sshCommand} />
            {newKeyName && (
              <p className="text-xs text-green-700 dark:text-green-300">
                Asegúrate de mover el archivo descargado a <code className="font-mono">~/.ssh/{newKeyName}.pem</code> y ejecutar:{" "}
                <code className="font-mono">chmod 400 ~/.ssh/{newKeyName}.pem</code>
              </p>
            )}
          </div>
        )}

        {/* Header actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
              isRunning ? "text-green-600" : "text-muted-foreground"
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-green-500" : "bg-muted-foreground"}`} />
              {instance.status === "running" ? "En ejecución" :
               instance.status === "stopped" ? "Detenida" :
               instance.status === "creating" ? "Creando..." : instance.status}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="font-mono text-sm">{instance.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {instance.status === "stopped" ? (
              <button onClick={() => handleAction("start")} className={`${btnBase} border bg-background hover:bg-accent`}>
                <Play className="w-3.5 h-3.5" /> Iniciar
              </button>
            ) : (
              <button onClick={() => handleAction("stop")} className={`${btnBase} border bg-background hover:bg-accent`}>
                <Square className="w-3.5 h-3.5" /> Detener
              </button>
            )}
            <button onClick={() => handleAction("restart")} className={`${btnBase} border bg-background hover:bg-accent`}>
              <RotateCw className="w-3.5 h-3.5" /> Reiniciar
            </button>
            <Link href={`/dashboard/instances/${instance.id}/console`} className={`${btnBase} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <Terminal className="w-3.5 h-3.5" /> Conectar
            </Link>
            <button onClick={() => handleAction("delete")} className={`${btnBase} border border-destructive/30 text-destructive hover:bg-destructive/10`}>
              <Trash2 className="w-3.5 h-3.5" /> Terminar
            </button>
          </div>
        </div>

        {/* Instance summary — AWS-style grid */}
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Resumen de instancia</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
            <DetailField label="ID de instancia" value={instance.id} mono />
            <DetailField
              label="Estado"
              value={isRunning ? "En ejecución" : instance.status === "stopped" ? "Detenida" : instance.status}
            />
            <DetailField
              label="Dirección IPv4 pública"
              value={publicIp || "— (configura PUBLIC_HOST en .env)"}
              mono={!!publicIp}
            />
            <DetailField
              label="Dirección IPv4 privada"
              value={instance.privateIp || "—"}
              mono={!!instance.privateIp}
            />
            <DetailField label="Tipo de instancia" value={`${instance.memoryLimit} MB / ${instance.cpuLimit} vCPU`} />
            <DetailField
              label="DNS público"
              value={instance.domains.length > 0 ? instance.domains.map((d) => d.domain).join(", ") : "—"}
            />
            <DetailField label="ID de contenedor" value={instance.containerId?.slice(0, 12) || "—"} mono />
            <DetailField label="Hora de lanzamiento" value={new Date(instance.createdAt).toLocaleString()} />
            <DetailField label="Hostname" value={`${instance.id.slice(0, 12)}-${instance.name}`} mono />
          </div>
        </div>

        {/* Networking */}
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Network className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Redes y conectividad</h2>
          </div>
          <div className="p-4 space-y-4">
            {!publicIp && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 flex gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-medium">Acceso público no configurado</p>
                  <p>Para exponer tus instancias al internet, configura <code className="font-mono">PUBLIC_HOST</code> en la API y <code className="font-mono">NEXT_PUBLIC_PUBLIC_HOST</code> en el frontend con la IP o dominio público de tu servidor.</p>
                  <p>Luego apunta tu DNS (A record) a esa IP y usa la sección Dominios para configurar HTTPS.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Puertos expuestos</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>App (Node.js)</span>
                    <span className="font-mono text-xs">{instance.internalPort ? `${instance.publicHost}:${instance.internalPort} → :3000` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HTTP (Nginx)</span>
                    <span className="font-mono text-xs">{instance.httpPort ? `${instance.publicHost}:${instance.httpPort} → :80` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SSH</span>
                    <span className="font-mono text-xs">{instance.sshPort ? `${instance.publicHost}:${instance.sshPort} → :22` : "—"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URLs de acceso</p>
                {instance.appUrl && isRunning ? (
                  <CopyField label="App URL" value={instance.appUrl} />
                ) : (
                  <p className="text-xs text-muted-foreground">Inicia la instancia para obtener URLs</p>
                )}
                {instance.httpUrl && isRunning && (
                  <CopyField label="HTTP URL" value={instance.httpUrl} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SSH Access */}
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Acceso SSH</h2>
            </div>
            <Link href="/dashboard/ssh-keys" className="text-xs text-primary hover:underline">
              Gestionar key pairs →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {instance.sshCommand && isRunning ? (
              <>
                <CopyField label="Comando SSH (copiar y pegar)" value={instance.sshCommand} />
                {instance.sshKeyName ? (
                  <p className="text-xs text-muted-foreground">
                    Usa el archivo <code className="font-mono">~/.ssh/{instance.sshKeyName}.pem</code>.
                    Si no lo tienes, créalo de nuevo en Key Pairs (no se puede volver a descargar).
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Esta instancia no tiene key pair asociado.{" "}
                    <Link href="/dashboard/ssh-keys" className="underline">Crea uno</Link> y lanza una nueva instancia con él.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isRunning
                  ? "Sin key pair asociado. Crea una nueva instancia con SSH habilitado."
                  : "Inicia la instancia para ver el comando SSH."}
              </p>
            )}
          </div>
        </div>

        {/* Quick access cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { href: `/dashboard/instances/${instance.id}/console`, icon: Terminal, label: "Terminal Web", desc: "Consola interactiva en el navegador — no requiere SSH" },
            { href: `/dashboard/instances/${instance.id}/monitoring`, icon: Activity, label: "Monitoreo", desc: "CPU, RAM y red en tiempo real" },
            { href: `/dashboard/backups?instance=${instance.id}`, icon: HardDrive, label: "Snapshots", desc: "Crear y restaurar copias de seguridad" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg border p-4 hover:bg-accent/50 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-muted group-hover:bg-background transition-colors">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Deploy */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Rocket className="w-4 h-4" /> Despliegue rápido
            </h2>
            <button
              onClick={async () => {
                setDeploying(true)
                try {
                  const result = await api.post<{ url: string; message: string }>(`/instances/${instance.id}/deploy-test`)
                  setDeployResult(result)
                } catch {}
                setDeploying(false)
              }}
              disabled={deploying || !isRunning}
              className={`${btnBase} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}
            >
              <Rocket className="w-3.5 h-3.5" />
              {deploying ? "Desplegando..." : "Deploy Test App"}
            </button>
          </div>
          <div className="p-4">
            {deployResult ? (
              <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30 p-3 space-y-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-400">{deployResult.message}</p>
                <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline font-mono">
                  <ExternalLink className="w-3.5 h-3.5" /> {deployResult.url}
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Despliega una app Node.js de prueba en el puerto 3000 del contenedor.
                {instance.internalPort && <> Accesible en <code className="font-mono">{instance.publicHost}:{instance.internalPort}</code></>}
              </p>
            )}
          </div>
        </div>

        {/* Domains */}
        {instance.domains.length > 0 && (
          <div className="rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <h2 className="text-sm font-semibold">Dominios asociados</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Dominio</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">SSL</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Acción DNS</th>
                  </tr>
                </thead>
                <tbody>
                  {instance.domains.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="p-4 font-mono text-xs">{d.domain}</td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${d.sslEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                          {d.sslEnabled ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        A record → {publicIp || "tu IP pública"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
