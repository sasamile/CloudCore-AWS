#!/usr/bin/env node
/**
 * @zyncloud/mcp — Servidor MCP (Model Context Protocol) para ZynCloud.
 *
 * Expone la infraestructura de ZynCloud como herramientas para agentes IA
 * (Claude, etc). Transporte: stdio JSON-RPC 2.0, protocolo MCP 2024-11-05.
 * Implementacion nativa, sin dependencias.
 *
 * Config por entorno:
 *   ZYNCLOUD_API_URL   (ej. https://apizyncloud.suescun.sbs)
 *   ZYNCLOUD_TOKEN     (JWT de usuario de ZynCloud)
 *
 * En Claude Desktop / Claude Code, registrar como:
 *   { "command": "node", "args": ["packages/mcp-server/src/index.js"],
 *     "env": { "ZYNCLOUD_API_URL": "...", "ZYNCLOUD_TOKEN": "..." } }
 */
import { createInterface } from 'node:readline';
import { ZynCloudApi } from './api';

const PROTOCOL_VERSION = '2024-11-05';

const api = new ZynCloudApi({
  baseUrl: process.env.ZYNCLOUD_API_URL || 'http://localhost:4000',
  token: process.env.ZYNCLOUD_TOKEN || '',
});

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, any>) => Promise<unknown>;
}

const tools: Tool[] = [
  {
    name: 'list_instances',
    description: 'Lista las instancias (servidores) del usuario en ZynCloud.',
    inputSchema: { type: 'object', properties: {} },
    run: () => api.listInstances(),
  },
  {
    name: 'create_instance',
    description: 'Crea una nueva instancia (contenedor Ubuntu). memoryLimit en MB, cpuLimit en cores.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        memoryLimit: { type: 'number' },
        cpuLimit: { type: 'number' },
      },
    },
    run: (a) => api.createInstance({ name: a.name, memoryLimit: a.memoryLimit, cpuLimit: a.cpuLimit }),
  },
  {
    name: 'start_instance',
    description: 'Enciende una instancia por id.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    run: (a) => api.startInstance(a.id),
  },
  {
    name: 'stop_instance',
    description: 'Apaga una instancia por id.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    run: (a) => api.stopInstance(a.id),
  },
  {
    name: 'list_buckets',
    description: 'Lista los buckets de object storage del usuario.',
    inputSchema: { type: 'object', properties: {} },
    run: () => api.listBuckets(),
  },
  {
    name: 'create_bucket',
    description: 'Crea un bucket de object storage.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    run: (a) => api.createBucket(a.name),
  },
  {
    name: 'list_databases',
    description: 'Lista las bases de datos gestionadas (DBaaS) del usuario.',
    inputSchema: { type: 'object', properties: {} },
    run: () => api.listDatabases(),
  },
  {
    name: 'create_database',
    description: 'Aprovisiona una nueva base de datos Postgres gestionada.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    run: (a) => api.createDatabase(a.name),
  },
];

function send(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function result(id: unknown, res: unknown) {
  send({ jsonrpc: '2.0', id, result: res });
}

function error(id: unknown, code: number, message: string) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg: any) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'zyncloud-mcp', version: '0.1.0' },
      });

    case 'notifications/initialized':
      return; // notificacion, sin respuesta

    case 'tools/list':
      return result(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case 'tools/call': {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) return error(id, -32602, `Herramienta desconocida: ${params?.name}`);
      try {
        const output = await tool.run(params.arguments || {});
        return result(id, {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        });
      } catch (e) {
        return result(id, {
          isError: true,
          content: [{ type: 'text', text: `Error: ${(e as Error).message}` }],
        });
      }
    }

    case 'ping':
      return result(id, {});

    default:
      if (id !== undefined) error(id, -32601, `Metodo no soportado: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: unknown;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  handle(msg).catch((e) => {
    process.stderr.write(`[zyncloud-mcp] ${(e as Error).message}\n`);
  });
});

process.stderr.write('[zyncloud-mcp] servidor MCP listo (stdio)\n');
