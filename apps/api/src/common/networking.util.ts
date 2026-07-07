export function getPublicHost(): string {
  return process.env.PUBLIC_HOST || 'localhost';
}

export function getBaseDomain(): string | null {
  return process.env.BASE_DOMAIN || null;
}

export function getRoutingMode(): 'tunnel' | 'port' | 'nginx' {
  const mode = process.env.ROUTING_MODE || 'port';
  if (mode === 'tunnel' || mode === 'nginx') return mode;
  return 'port';
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'app';
}

export function buildInstanceHostname(instanceName: string): string | null {
  const base = getBaseDomain();
  if (!base) return null;
  return `${slugify(instanceName)}.${base}`;
}

export function buildPublicUrl(opts: {
  hostname?: string | null;
  port?: number | null;
  useHttps?: boolean;
}): string | null {
  const mode = getRoutingMode();
  if (mode === 'tunnel' && opts.hostname) {
    return `https://${opts.hostname}`;
  }
  if (opts.port) {
    const scheme = opts.useHttps ? 'https' : 'http';
    return `${scheme}://${getPublicHost()}:${opts.port}`;
  }
  return null;
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
  name: string;
  internalPort?: number | null;
  httpPort?: number | null;
  sshPort?: number | null;
  ipAddress?: string | null;
  status?: string;
  sshKey?: { name: string } | null;
  domains?: { domain: string }[];
}>(instance: T) {
  const publicHost = getPublicHost();
  const httpPort = instance.httpPort ?? (instance.internalPort ? instance.internalPort + 1 : null);
  const sshPort = instance.sshPort ?? (instance.internalPort ? instance.internalPort + 2 : null);
  const sshKeyName = instance.sshKey?.name ?? null;
  const routingMode = getRoutingMode();
  const baseDomain = getBaseDomain();
  const suggestedHostname = buildInstanceHostname(instance.name);
  const customDomain = instance.domains?.[0]?.domain ?? null;

  const tunnelHostname = customDomain || suggestedHostname;
  const appUrl = buildPublicUrl({
    hostname: tunnelHostname,
    port: instance.internalPort ?? null,
  });
  const httpUrl = buildPublicUrl({
    hostname: customDomain ? customDomain : suggestedHostname ? `www.${suggestedHostname}` : null,
    port: httpPort,
  });

  return {
    ...instance,
    httpPort,
    sshPort,
    publicHost,
    sshKeyName,
    privateIp: instance.ipAddress,
    routingMode,
    baseDomain,
    suggestedHostname,
    suggestedDomain: suggestedHostname,
    appUrl: instance.internalPort ? appUrl : null,
    httpUrl: httpPort ? (routingMode === 'tunnel' && tunnelHostname ? `https://${tunnelHostname}` : `http://${publicHost}:${httpPort}`) : null,
    sshCommand: sshPort && instance.status === 'running'
      ? buildSshCommand({ sshPort, publicHost, sshKeyName })
      : null,
  };
}
