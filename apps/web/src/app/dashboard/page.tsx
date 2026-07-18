"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Server,
  Cpu,
  MemoryStick,
  Globe,
  Plus,
  ArrowRight,
  RefreshCw,
  Database,
  HardDrive,
  Activity,
  BookOpen,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { api } from "@/lib/api"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DashboardSkeleton } from "@/components/skeletons/page-skeletons"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface DashboardStats {
  totalInstances: number
  runningInstances: number
  stoppedInstances: number
  totalDomains: number
  totalCpuUsage: number
  totalMemoryUsage: number
  totalMemoryLimit: number
}

interface Instance {
  id: string
  name: string
  status: string
  memoryLimit: number
  cpuLimit: number
  internalPort: number | null
  createdAt: string
}

interface InstanceMetric {
  name: string
  memory: number
  cpu: number
  limit: number
}

interface HistoryPoint {
  time: string
  cpu: number
  memory: number
}

interface Bucket {
  id: string
  objectCount: number
}

interface Backup {
  id: string
}

const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  stopped: "#94a3b8",
  creating: "#f59e0b",
  error: "#ef4444",
}

function StatusBadge({ status }: { status: string }) {
  const running = status === "running"
  return (
    <Badge variant={running ? "success" : status === "error" ? "destructive" : "muted"} className="gap-1.5 capitalize">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          running ? "bg-emerald-500" : status === "error" ? "bg-destructive" : "bg-muted-foreground"
        }`}
      />
      {status}
    </Badge>
  )
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  progress,
  children,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  progress?: number
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon className="w-4 h-4 text-muted-foreground/50" />
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      {progress !== undefined && <Progress value={progress} className="mt-3 h-1" />}
      {children}
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm text-xs">
      <p className="font-medium mb-1 text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-foreground">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          {p.name === "CPU" ? "%" : p.name === "RAM" ? " MB" : ""}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])
  const [instanceMetrics, setInstanceMetrics] = useState<InstanceMetric[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [bucketCount, setBucketCount] = useState(0)
  const [snapshotCount, setSnapshotCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const loadStats = useCallback(async () => {
    try {
      const s = await api.get<DashboardStats>("/instances/stats")
      setStats(s)
      const now = new Date()
      const label = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      setHistory((prev) => [
        ...prev.slice(-29),
        { time: label, cpu: s.totalCpuUsage, memory: s.totalMemoryUsage },
      ])
      setLastUpdated(now)
    } catch {}
  }, [])

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true)
      try {
        const [instList, buckets, backups] = await Promise.all([
          api.get<Instance[]>("/instances").catch(() => []),
          api.get<Bucket[]>("/storage/buckets").catch(() => []),
          api.get<Backup[]>("/backups").catch(() => []),
        ])
        setInstances(instList)
        setBucketCount(buckets.length)
        setSnapshotCount(backups.length)

        const running = instList.filter((i) => i.status === "running")
        const metrics = await Promise.all(
          running.map(async (inst) => {
            try {
              const m = await api.get<{ memoryUsageMb: number; cpuPercent: number }>(`/monitoring/${inst.id}`)
              return { name: inst.name, memory: m.memoryUsageMb, cpu: m.cpuPercent, limit: inst.memoryLimit }
            } catch {
              return { name: inst.name, memory: 0, cpu: 0, limit: inst.memoryLimit }
            }
          }),
        )
        setInstanceMetrics(metrics)
        await loadStats()
      } finally {
        setRefreshing(false)
        setPageLoading(false)
      }
    },
    [loadStats],
  )

  useEffect(() => {
    loadAll()
    const interval = setInterval(() => loadStats(), 5000)
    return () => clearInterval(interval)
  }, [loadAll, loadStats])

  const memoryPct = stats?.totalMemoryLimit
    ? Math.min((stats.totalMemoryUsage / stats.totalMemoryLimit) * 100, 100)
    : 0

  const cpuPct = Math.min(stats?.totalCpuUsage ?? 0, 100)

  const statusData = [
    { name: "Running", value: stats?.runningInstances ?? 0, color: STATUS_COLORS.running },
    { name: "Stopped", value: stats?.stoppedInstances ?? 0, color: STATUS_COLORS.stopped },
  ].filter((d) => d.value > 0)

  const otherCount =
    (stats?.totalInstances ?? 0) - (stats?.runningInstances ?? 0) - (stats?.stoppedInstances ?? 0)
  if (otherCount > 0) {
    statusData.push({ name: "Other", value: otherCount, color: STATUS_COLORS.error })
  }

  return (
    <>
      <Header title="Dashboard" />
      <PageShell maxWidth="full">
        {pageLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <PageHeader
              title="Resumen"
              description={`Infraestructura Docker · actualizado ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => loadAll(true)}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                  <Button asChild className="h-9">
                    <Link href="/dashboard/instances/new">
                      <Plus className="w-3.5 h-3.5" /> Lanzar instancia
                    </Link>
                  </Button>
                </>
              }
            />

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard title="Instancias" value={stats?.totalInstances ?? 0} icon={Server}>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge variant="success" className="text-[10px] h-4.5 px-1.5">
                    {stats?.runningInstances ?? 0} activas
                  </Badge>
                  <Badge variant="muted" className="text-[10px] h-4.5 px-1.5">
                    {stats?.stoppedInstances ?? 0} detenidas
                  </Badge>
                </div>
              </KpiCard>

              <KpiCard
                title="CPU"
                value={`${(stats?.totalCpuUsage ?? 0).toFixed(1)}%`}
                subtitle="uso agregado"
                icon={Cpu}
                progress={cpuPct}
              />

              <KpiCard
                title="Memoria"
                value={`${stats?.totalMemoryUsage ?? 0} MB`}
                subtitle={`de ${stats?.totalMemoryLimit ?? 0} MB`}
                icon={MemoryStick}
                progress={memoryPct}
              />

              <KpiCard
                title="Dominios"
                value={stats?.totalDomains ?? 0}
                subtitle="configurados"
                icon={Globe}
              />

              <KpiCard title="Buckets" value={bucketCount} subtitle="object storage" icon={Database} />

              <KpiCard title="Snapshots" value={snapshotCount} subtitle="respaldos" icon={HardDrive} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CPU + Memory area chart */}
              <div className="lg:col-span-2 rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      Utilización de recursos
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">CPU y memoria en tiempo real</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-foreground/70" /> CPU %
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50" /> RAM MB
                    </span>
                  </div>
                </div>
                {history.length < 2 ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    Recopilando datos...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#334155" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#334155" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="cpu"
                        name="CPU"
                        stroke="#334155"
                        fill="url(#cpuGrad)"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="memory"
                        name="RAM"
                        stroke="#94a3b8"
                        fill="url(#memGrad)"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Instance status pie */}
              <div className="rounded-2xl border border-border p-5">
                <p className="text-sm font-medium mb-0.5">Estado de instancias</p>
                <p className="text-xs text-muted-foreground mb-4">Distribución actual</p>
                {statusData.length === 0 ? (
                  <div className="h-[220px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                    <Server className="w-8 h-8 opacity-20" />
                    Sin instancias
                  </div>
                ) : (
                  <>
                    <div className="h-[180px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={72}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {statusData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${value} instancias`, name]}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <p className="text-2xl font-semibold tabular-nums">{stats?.totalInstances ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">total</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center gap-4 mt-3">
                      {statusData.map((d) => (
                        <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          {d.name} ({d.value})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Per-instance charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border p-5">
                <p className="text-sm font-medium mb-0.5">Memoria por instancia</p>
                <p className="text-xs text-muted-foreground mb-4">Instancias en ejecución</p>
                {instanceMetrics.length === 0 ? (
                  <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                    No hay instancias activas
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={instanceMetrics} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        unit=" MB"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={72}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(1)} MB`,
                          name === "memory" ? "En uso" : name,
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar
                        dataKey="memory"
                        name="memory"
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.5}
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-border p-5">
                <p className="text-sm font-medium mb-0.5">CPU por instancia</p>
                <p className="text-xs text-muted-foreground mb-4">Uso actual de procesador</p>
                {instanceMetrics.length === 0 ? (
                  <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                    No hay instancias activas
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={instanceMetrics} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        unit="%"
                        domain={[0, "auto"]}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={72}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "CPU"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar
                        dataKey="cpu"
                        name="cpu"
                        fill="hsl(var(--foreground))"
                        fillOpacity={0.65}
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent instances */}
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-medium">Instancias recientes</p>
                <Button variant="ghost" size="sm" asChild className="h-8 text-muted-foreground text-xs gap-1">
                  <Link href="/dashboard/instances">
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
              {instances.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Aún no tienes instancias.{" "}
                  <Link href="/dashboard/instances/new" className="text-foreground underline underline-offset-4">
                    Lanza la primera
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                        <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Estado</th>
                        <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                        <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Puerto</th>
                        <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Creada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instances.slice(0, 5).map((inst) => (
                        <tr
                          key={inst.id}
                          className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors duration-150"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/instances/${inst.id}`}
                              className="font-medium hover:underline underline-offset-4"
                            >
                              {inst.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={inst.status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {inst.memoryLimit}MB / {inst.cpuLimit}vCPU
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {inst.internalPort || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(inst.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
              {[
                { href: "/dashboard/instances/new", title: "Lanzar instancia", desc: "Nuevo contenedor Ubuntu", icon: Server },
                { href: "/dashboard/domains", title: "Dominios", desc: "DNS y HTTPS", icon: Globe },
                { href: "/dashboard/storage", title: "Object Storage", desc: "Buckets y archivos", icon: Database },
                { href: "/dashboard/storage/docs", title: "API Docs", desc: "Integrar con SDKs", icon: BookOpen },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-background p-4 hover:bg-muted/40 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{item.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </PageShell>
    </>
  )
}
