"use client"

import { useEffect, useState } from "react"
import { Server, Cpu, MemoryStick, Globe, Plus, ArrowRight } from "lucide-react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

function StatusBadge({ status }: { status: string }) {
  const running = status === "running"
  return (
    <Badge variant={running ? "success" : "muted"} className="gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-emerald-500" : "bg-muted-foreground"}`} />
      {status}
    </Badge>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])

  useEffect(() => {
    api.get<DashboardStats>("/instances/stats").then(setStats).catch(() => {})
    api.get<Instance[]>("/instances").then(setInstances).catch(() => {})
  }, [])

  const memoryPct = stats?.totalMemoryLimit
    ? Math.min((stats.totalMemoryUsage / stats.totalMemoryLimit) * 100, 100)
    : 0

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Manage your Docker instances and infrastructure.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/instances/new">
              <Plus className="w-4 h-4" /> Launch instance
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Instances</CardTitle>
              <Server className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalInstances ?? 0}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" className="text-[10px]">{stats?.runningInstances ?? 0} running</Badge>
                <Badge variant="muted" className="text-[10px]">{stats?.stoppedInstances ?? 0} stopped</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CPU Usage</CardTitle>
              <Cpu className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats?.totalCpuUsage ?? 0).toFixed(1)}%</div>
              <Progress value={Math.min(stats?.totalCpuUsage ?? 0, 100)} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
              <MemoryStick className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMemoryUsage ?? 0} MB</div>
              <p className="text-xs text-muted-foreground mt-1">
                of {stats?.totalMemoryLimit ?? 0} MB allocated
              </p>
              <Progress value={memoryPct} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Domains</CardTitle>
              <Globe className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalDomains ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">configured</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-sm font-medium">Recent instances</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link href="/dashboard/instances">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {instances.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No instances yet. Launch your first instance to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.slice(0, 5).map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell>
                        <Link href={`/dashboard/instances/${inst.id}`} className="font-medium hover:underline">
                          {inst.name}
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={inst.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{inst.memoryLimit}MB / {inst.cpuLimit}vCPU</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{inst.internalPort || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(inst.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { href: "/dashboard/instances/new", title: "Launch instance", desc: "Create a new Ubuntu container with custom resources" },
            { href: "/dashboard/domains", title: "Configure domain", desc: "Set up DNS and SSL for your instances" },
            { href: "/dashboard/backups", title: "Create snapshot", desc: "Back up your instance data" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover:bg-accent/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                  <CardDescription className="text-xs">{item.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
