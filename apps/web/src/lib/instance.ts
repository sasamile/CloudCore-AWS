export interface InstanceNetworking {
  id: string
  name: string
  containerId: string | null
  status: string
  memoryLimit: number
  cpuLimit: number
  ipAddress: string | null
  internalPort: number | null
  httpPort: number | null
  sshPort: number | null
  publicHost: string
  privateIp: string | null
  appUrl: string | null
  httpUrl: string | null
  sshCommand: string | null
  sshKeyName: string | null
  routingMode?: string
  baseDomain?: string | null
  suggestedHostname?: string | null
  suggestedDomain?: string | null
  createdAt: string
  domains: { id: string; domain: string; sslEnabled: boolean }[]
}

export function getPublicHost() {
  return process.env.NEXT_PUBLIC_PUBLIC_HOST || "localhost"
}

export function downloadPem(name: string, content: string) {
  const blob = new Blob([content], { type: "application/x-pem-file" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}.pem`
  a.click()
  URL.revokeObjectURL(url)
}
