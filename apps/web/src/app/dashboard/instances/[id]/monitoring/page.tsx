"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { Cpu, MemoryStick, Wifi, HardDrive } from "lucide-react"

interface Stats {
  cpuPercent: number
  memoryUsageMb: number
  memoryLimitMb: number
  memoryPercent: number
  networkRxMb: number
  networkTxMb: number
  blockReadMb: number
  blockWriteMb: number
  timestamp: string
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`)
    .join(" ")
  return (
    <svg viewBox="0 0 100 100" className="w-full h-16 mt-2" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function MonitoringPage() {
  const params = useParams()
  const [currentStats, setCurrentStats] = useState<Stats | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [instanceName, setInstanceName] = useState("")

  useEffect(() => {
    api.get<{ name: string }>(`/instances/${params.id}`).then((data) => setInstanceName(data.name)).catch(() => {})
  }, [params.id])

  useEffect(() => {
    const socket = getSocket()
    socket.emit("stats:subscribe", { instanceId: params.id })
    socket.on("stats:data", (stats: Stats) => {
      setCurrentStats(stats)
      setCpuHistory((prev) => [...prev.slice(-59), stats.cpuPercent])
      setMemHistory((prev) => [...prev.slice(-59), stats.memoryPercent])
    })
    return () => {
      socket.emit("stats:unsubscribe", { instanceId: params.id })
      socket.off("stats:data")
    }
  }, [params.id])

  return (
    <>
      <Header
        title="Monitoring"
        breadcrumbs={[
          { label: "Compute", href: "/dashboard/instances" },
          { label: "Instances", href: "/dashboard/instances" },
          { label: instanceName || "...", href: `/dashboard/instances/${params.id}` },
        ]}
      />
      <div className="w-full px-4 py-6 sm:px-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">CPU Utilization</span>
              <Cpu className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{currentStats?.cpuPercent.toFixed(1) ?? "0"}%</p>
            {cpuHistory.length > 1 && <MiniChart data={cpuHistory} color="#171717" />}
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Memory</span>
              <MemoryStick className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{currentStats?.memoryUsageMb.toFixed(0) ?? "0"} MB</p>
            <p className="text-xs text-muted-foreground">of {currentStats?.memoryLimitMb ?? 0} MB</p>
            {memHistory.length > 1 && <MiniChart data={memHistory} color="#171717" />}
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Network I/O</span>
              <Wifi className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">RX</span>
                <span className="font-medium font-mono text-xs">{currentStats?.networkRxMb.toFixed(2) ?? "0"} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TX</span>
                <span className="font-medium font-mono text-xs">{currentStats?.networkTxMb.toFixed(2) ?? "0"} MB</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Disk I/O</span>
              <HardDrive className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Read</span>
                <span className="font-medium font-mono text-xs">{currentStats?.blockReadMb.toFixed(2) ?? "0"} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Write</span>
                <span className="font-medium font-mono text-xs">{currentStats?.blockWriteMb.toFixed(2) ?? "0"} MB</span>
              </div>
            </div>
          </div>
        </div>

        {!currentStats && (
          <div className="rounded-lg border p-10 text-center">
            <p className="text-sm text-muted-foreground">Waiting for monitoring data... Make sure the instance is running.</p>
          </div>
        )}
      </div>
    </>
  )
}
