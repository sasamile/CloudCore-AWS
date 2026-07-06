"use client"

import { useEffect, useState } from "react"
import { Server, Cpu, MemoryStick, Globe, Plus, ArrowRight } from "lucide-react"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import Link from "next/link"

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])

  useEffect(() => {
    api.get<DashboardStats>("/instances/stats").then(setStats).catch(() => {})
    api.get<Instance[]>("/instances").then(setInstances).catch(() => {})
  }, [])

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
          <Link
            href="/dashboard/instances/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 gap-2"
          >
            <Plus className="w-4 h-4" /> Launch instance
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Instances</span>
              <Server className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{stats?.totalInstances ?? 0}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {stats?.runningInstances ?? 0} running
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                {stats?.stoppedInstances ?? 0} stopped
              </span>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">CPU Usage</span>
              <Cpu className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{(stats?.totalCpuUsage ?? 0).toFixed(1)}%</p>
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/20 rounded-full transition-all"
                style={{ width: `${Math.min(stats?.totalCpuUsage ?? 0, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Memory</span>
              <MemoryStick className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{stats?.totalMemoryUsage ?? 0} MB</p>
            <p className="text-xs text-muted-foreground mt-1">
              of {stats?.totalMemoryLimit ?? 0} MB allocated
            </p>
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/20 rounded-full transition-all"
                style={{
                  width: `${stats?.totalMemoryLimit ? Math.min((stats.totalMemoryUsage / stats.totalMemoryLimit) * 100, 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Domains</span>
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{stats?.totalDomains ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">configured</p>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-medium">Recent instances</h3>
            <Link href="/dashboard/instances" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {instances.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No instances yet. Launch your first instance to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Name</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Status</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Type</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Port</th>
                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.slice(0, 5).map((inst) => (
                    <tr key={inst.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <Link href={`/dashboard/instances/${inst.id}`} className="font-medium hover:underline">
                          {inst.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          inst.status === "running" ? "text-green-600" : "text-muted-foreground"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            inst.status === "running" ? "bg-green-500" : "bg-muted-foreground"
                          }`} />
                          {inst.status}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{inst.memoryLimit}MB / {inst.cpuLimit}vCPU</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{inst.internalPort || "—"}</td>
                      <td className="p-4 text-muted-foreground">{new Date(inst.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/instances/new" className="rounded-lg border p-4 hover:bg-accent transition-colors group">
            <h4 className="text-sm font-medium mb-1">Launch instance</h4>
            <p className="text-xs text-muted-foreground">Create a new Ubuntu container with custom resources</p>
          </Link>
          <Link href="/dashboard/domains" className="rounded-lg border p-4 hover:bg-accent transition-colors group">
            <h4 className="text-sm font-medium mb-1">Configure domain</h4>
            <p className="text-xs text-muted-foreground">Set up DNS and SSL for your instances</p>
          </Link>
          <Link href="/dashboard/backups" className="rounded-lg border p-4 hover:bg-accent transition-colors group">
            <h4 className="text-sm font-medium mb-1">Create snapshot</h4>
            <p className="text-xs text-muted-foreground">Back up your instance data</p>
          </Link>
        </div>
      </div>
    </>
  )
}
