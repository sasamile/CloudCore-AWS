export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface Instance {
  id: string
  name: string
  containerId: string | null
  imageTag: string
  status: "running" | "stopped" | "creating" | "error"
  memoryLimit: number
  cpuLimit: number
  internalPort: number | null
  ipAddress: string | null
  createdAt: string
  updatedAt: string
  domains?: Domain[]
}

export interface Domain {
  id: string
  domain: string
  targetPort: number
  sslEnabled: boolean
  nginxConfig: string | null
  createdAt: string
  instanceId: string
  instance?: Pick<Instance, "id" | "name">
}

export interface Backup {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  createdAt: string
  instanceId: string
  instance?: Pick<Instance, "id" | "name">
}

export interface ContainerStats {
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

export interface DashboardStats {
  totalInstances: number
  runningInstances: number
  stoppedInstances: number
  totalDomains: number
  totalCpuUsage: number
  totalMemoryUsage: number
  totalMemoryLimit: number
}
