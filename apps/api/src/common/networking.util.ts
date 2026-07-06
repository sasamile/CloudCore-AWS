export function getPublicHost(): string {
  return process.env.PUBLIC_HOST || 'localhost';
}

export function extractContainerIp(info: {
  NetworkSettings?: {
    IPAddress?: string;
    Networks?: Record<string, { IPAddress?: string }>;
  };
}): string | null {
  const networks = info.NetworkSettings?.Networks || {};
  for (const net of Object.values(networks)) {
    if (net.IPAddress) return net.IPAddress;
  }
  return info.NetworkSettings?.IPAddress || null;
}

export function buildSshCommand(opts: {
  sshPort: number;
  publicHost: string;
  sshKeyName?: string | null;
}): string {
  const keyFlag = opts.sshKeyName ? `-i ~/.ssh/${opts.sshKeyName}.pem ` : '';
  return `ssh ${keyFlag}-p ${opts.sshPort} root@${opts.publicHost}`;
}

export function enrichInstance<T extends {
  internalPort?: number | null;
  httpPort?: number | null;
  sshPort?: number | null;
  ipAddress?: string | null;
  status?: string;
  sshKey?: { name: string } | null;
}>(instance: T) {
  const publicHost = getPublicHost();
  const httpPort = instance.httpPort ?? (instance.internalPort ? instance.internalPort + 1 : null);
  const sshPort = instance.sshPort ?? (instance.internalPort ? instance.internalPort + 2 : null);
  const sshKeyName = instance.sshKey?.name ?? null;

  return {
    ...instance,
    httpPort,
    sshPort,
    publicHost,
    sshKeyName,
    privateIp: instance.ipAddress,
    appUrl: instance.internalPort ? `http://${publicHost}:${instance.internalPort}` : null,
    httpUrl: httpPort ? `http://${publicHost}:${httpPort}` : null,
    sshCommand: sshPort && instance.status === 'running'
      ? buildSshCommand({ sshPort, publicHost, sshKeyName })
      : null,
  };
}
