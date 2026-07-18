"use client"

import Link from "next/link"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Copy, Check, ExternalLink, KeyRound, HardDrive, ShieldCheck } from "lucide-react"
import { useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-border bg-muted/50 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      <pre className="p-4 text-xs font-mono overflow-x-auto bg-muted/30 leading-relaxed">{code}</pre>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  )
}

const toc = [
  { id: "overview", label: "Descripción general" },
  { id: "install", label: "Instalación (SDKs)" },
  { id: "auth", label: "Autenticación (ZynAuth)" },
  { id: "pools", label: "Pools de usuarios" },
  { id: "storage", label: "Object Storage (S3)" },
  { id: "keys", label: "Access Keys" },
  { id: "storage-sdk", label: "SDK de Storage" },
  { id: "endpoints", label: "Referencia REST" },
  { id: "notes", label: "Notas y límites" },
]

export default function ApiDocsPage() {
  return (
    <>
      <Header
        title="API para Desarrolladores"
        breadcrumbs={[
          { label: "Storage", href: "/dashboard/storage" },
          { label: "API Docs" },
        ]}
      />
      <PageShell maxWidth="full">
        <div className="flex flex-col lg:flex-row gap-8">
          <nav className="lg:w-52 shrink-0">
            <div className="lg:sticky lg:top-20 space-y-1">
              <Button variant="ghost" asChild className="w-full justify-start -ml-2 mb-3 h-9 text-muted-foreground">
                <Link href="/dashboard/storage">
                  <ArrowLeft /> Volver a Storage
                </Link>
              </Button>
              <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                En esta página
              </p>
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0 space-y-10">
            <PageHeader
              title="API para Desarrolladores de Zyntek"
              description="ZynCloud es tu mini-AWS: identidad (ZynAuth) y almacenamiento (Object Storage), con SDKs oficiales publicados en npm. Registra tu app, autentica usuarios y guarda archivos en minutos."
            />
            <div className="flex flex-wrap gap-2 -mt-4">
              <Badge variant="secondary">@zyntek/zynauth</Badge>
              <Badge variant="secondary">@zyntek/storage</Badge>
              <Badge variant="secondary">OIDC</Badge>
              <Badge variant="secondary">Firma ZYN1</Badge>
              <Badge variant="secondary">REST</Badge>
            </div>

            {/* OVERVIEW */}
            <Section id="overview" title="Descripción general">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium text-sm">ZynAuth — Identidad</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cada app registrada tiene su propio <strong>pool de usuarios</strong> (como Cognito).
                    Login embebido con MFA, OIDC estándar y SSO. SDK: <code className="text-[10px] bg-muted px-1 rounded">@zyntek/zynauth</code>.
                  </p>
                </div>
                <div className="rounded-2xl border border-border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium text-sm">Object Storage — Archivos</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Buckets y objetos estilo S3. Acceso por <strong>Access Key + Secret</strong> con firma ZYN1,
                    igual que AWS. SDK: <code className="text-[10px] bg-muted px-1 rounded">@zyntek/storage</code>.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm font-mono">
                Base URL · {API_URL}
              </div>
            </Section>

            {/* INSTALL */}
            <Section id="install" title="Instalación (SDKs)">
              <p className="text-sm text-muted-foreground">
                Los SDKs están publicados en npm. Instala solo lo que tu app necesite:
              </p>
              <CodeBlock
                title="bun / npm"
                code={`# Autenticación de usuarios
bun add @zyntek/zynauth

# Almacenamiento de archivos (S3)
bun add @zyntek/storage`}
              />
              <p className="text-sm text-muted-foreground">
                Ambos funcionan en el backend (Node 18+). Las credenciales
                (<code className="text-xs bg-muted px-1 rounded">client_secret</code>,
                <code className="text-xs bg-muted px-1 rounded">secretAccessKey</code>) viven solo en el servidor.
              </p>
            </Section>

            {/* AUTH */}
            <Section id="auth" title="Autenticación (ZynAuth)">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Registra tu app en <Link href="/dashboard/apps" className="text-primary hover:underline">Apps</Link> y
                obtén <code className="text-xs bg-muted px-1 rounded">client_id</code> y{" "}
                <code className="text-xs bg-muted px-1 rounded">client_secret</code>. El SDK hace login embebido
                (sin redirect) y maneja MFA por ti — como Amplify con Cognito.
              </p>
              <CodeBlock
                title="Login con @zyntek/zynauth"
                code={`import { ZynAuthClient } from '@zyntek/zynauth';

const zynauth = new ZynAuthClient({
  issuer: process.env.ZYNAUTH_ISSUER!,            // ${API_URL}
  clientId: process.env.ZYNAUTH_CLIENT_ID!,       // zyn_...
  clientSecret: process.env.ZYNAUTH_CLIENT_SECRET, // solo backend
});

const result = await zynauth.signIn(email, password);

if (result.status === 'MFA_REQUIRED') {
  // el usuario tiene 2FA: pide el código y complétalo
  const tokens = await zynauth.confirmMfa(result.session, code);
} else {
  const { tokens } = result; // id_token, access_token, refresh_token
}`}
              />
              <p className="text-sm text-muted-foreground">
                Guarda los tokens en la sesión del servidor (patrón BFF), no en el navegador. Para registrar
                usuarios desde tu app:
              </p>
              <CodeBlock
                title="Registro"
                code={`await zynauth.register(email, password, 'Nombre Apellido');`}
              />
            </Section>

            {/* POOLS */}
            <Section id="pools" title="Pools de usuarios">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cada app tiene su <strong>propio directorio de usuarios</strong>, aislado del resto y de los
                administradores de ZynCloud — exactamente como los User Pools de Cognito. Los gestionas desde{" "}
                <Link href="/dashboard/apps" className="text-primary hover:underline">Apps → 👥 Usuarios</Link>:
                crear, listar, resetear contraseña y eliminar.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>El login valida contra el pool del <code className="text-xs bg-muted px-1 rounded">client_id</code> de tu app.</li>
                <li>Los access tokens llevan <code className="text-xs bg-muted px-1 rounded">user_source: &quot;app&quot;</code> para distinguirlos.</li>
                <li>Bloqueo automático tras 5 intentos fallidos (15 min).</li>
              </ul>
            </Section>

            {/* STORAGE */}
            <Section id="storage" title="Object Storage (S3)">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { term: "Bucket", desc: "Contenedor lógico. Nombre en minúsculas (ej. orbidev-assets)." },
                  { term: "Object", desc: "Un archivo dentro del bucket. Tiene una key y metadata." },
                  { term: "Key", desc: "Ruta/nombre del objeto. Ej: avatars/u1.png" },
                ].map((item) => (
                  <div key={item.term} className="rounded-2xl border border-border p-4 space-y-1">
                    <p className="font-medium text-sm">{item.term}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Flujo típico: crear Access Key → crear bucket → subir → listar → descargar → eliminar.
                Dos formas de autenticar: <strong>JWT</strong> (tu login de consola, para el panel) o{" "}
                <strong>Access Key + firma ZYN1</strong> (para apps y scripts).
              </p>
            </Section>

            {/* ACCESS KEYS */}
            <Section id="keys" title="Access Keys (firma ZYN1)">
              <p className="text-sm text-muted-foreground leading-relaxed">
                En <Link href="/dashboard/access-keys" className="text-primary hover:underline">Access Keys</Link> crea
                una credencial. Obtienes un <code className="text-xs bg-muted px-1 rounded">ZYNAK...</code> y un secret
                que se muestra <strong>una sola vez</strong>. Es el equivalente al Access Key ID + Secret de AWS.
              </p>
              <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-1 text-xs font-mono">
                <div>Authorization: ZYN1-HMAC-SHA256 Credential=&lt;accessKeyId&gt;, Signature=&lt;hmac&gt;</div>
                <div>X-Zyn-Date: &lt;ISO8601&gt;</div>
                <div>X-Zyn-Content-Sha256: UNSIGNED-PAYLOAD</div>
              </div>
              <p className="text-sm text-muted-foreground">
                La firma = <code className="text-xs bg-muted px-1 rounded">HMAC-SHA256(secret, &quot;METHOD\nPATH\nDATE\nCONTENT_SHA&quot;)</code>.
                No la calcules a mano: el SDK <code className="text-xs bg-muted px-1 rounded">@zyntek/storage</code> lo hace por ti.
              </p>
            </Section>

            {/* STORAGE SDK */}
            <Section id="storage-sdk" title="SDK de Storage (@zyntek/storage)">
              <CodeBlock
                title="Subir y descargar archivos"
                code={`import { ZynStorageClient } from '@zyntek/storage';

const storage = new ZynStorageClient({
  endpoint: process.env.ZYNCLOUD_STORAGE_ENDPOINT!, // ${API_URL}
  accessKeyId: process.env.ZYNCLOUD_ACCESS_KEY_ID!, // ZYNAK...
  secretAccessKey: process.env.ZYNCLOUD_SECRET!,
});

// Crea el bucket si no existe (idempotente)
const bucket = await storage.ensureBucket('orbidev-assets');

// Sube un archivo
await storage.putObject(bucket.id, 'avatars/u1.png', pngBuffer, 'image/png');

// Descarga por key
const { data, contentType } = await storage.getObjectByKey(bucket.id, 'avatars/u1.png');

// Lista y elimina
const objetos = await storage.listObjects(bucket.id);
await storage.deleteObject(bucket.id, objetos[0].id);`}
              />
              <p className="text-sm text-muted-foreground">
                Si prefieres HTTP directo (sin SDK), firma tú la petición o usa un JWT. Ejemplo con curl + JWT:
              </p>
              <CodeBlock
                title="Alternativa: curl con JWT"
                code={`# 1. Token de consola
curl -X POST ${API_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"tu@email.com","password":"tu-password"}'

# 2. Subir un archivo (multipart)
curl -X POST ${API_URL}/storage/buckets/BUCKET_ID/upload \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@./imagen.png" \\
  -F "key=fotos/imagen.png"`}
              />
            </Section>

            {/* ENDPOINTS */}
            <Section id="endpoints" title="Referencia REST">
              <p className="text-sm font-medium text-muted-foreground">Autenticación</p>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground">Método</th>
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground">Ruta</th>
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ["POST", "/zynauth/auth/login", "Login embebido → tokens o challenge MFA"],
                      ["POST", "/zynauth/auth/mfa", "Completar el reto de MFA"],
                      ["POST", "/zynauth/register", "Auto-registro de usuario en el pool"],
                      ["POST", "/oauth2/token", "OIDC: authorization_code + refresh_token"],
                      ["GET", "/oauth2/userinfo", "Datos del usuario (Bearer)"],
                      ["GET", "/.well-known/openid-configuration", "Discovery OIDC"],
                    ].map(([method, path, desc]) => (
                      <tr key={path} className="hover:bg-muted/30">
                        <td className="p-4">
                          <Badge variant={method === "GET" ? "secondary" : "default"} className="font-mono text-[10px]">{method}</Badge>
                        </td>
                        <td className="p-4 font-mono text-xs">{path}</td>
                        <td className="p-4 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-sm font-medium text-muted-foreground pt-2">Storage &amp; Access Keys</p>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground">Método</th>
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground">Ruta</th>
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ["GET", "/zynauth/access-keys", "Listar access keys (JWT)"],
                      ["POST", "/zynauth/access-keys", "Crear access key (JWT)"],
                      ["DELETE", "/zynauth/access-keys/:id", "Revocar access key (JWT)"],
                      ["GET", "/storage/buckets", "Listar buckets"],
                      ["POST", "/storage/buckets", "Crear bucket"],
                      ["DELETE", "/storage/buckets/:id", "Eliminar bucket y sus objetos"],
                      ["GET", "/storage/buckets/:id/objects", "Listar objetos"],
                      ["POST", "/storage/buckets/:id/upload", "Subir archivo (multipart)"],
                      ["GET", "/storage/buckets/:bucketId/objects/:objectId/download", "Descargar objeto"],
                      ["DELETE", "/storage/buckets/:bucketId/objects/:objectId", "Eliminar objeto"],
                    ].map(([method, path, desc]) => (
                      <tr key={path} className="hover:bg-muted/30">
                        <td className="p-4">
                          <Badge variant={method === "GET" ? "secondary" : method === "DELETE" ? "destructive" : "default"} className="font-mono text-[10px]">{method}</Badge>
                        </td>
                        <td className="p-4 font-mono text-xs">{path}</td>
                        <td className="p-4 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* NOTES */}
            <Section id="notes" title="Notas y límites">
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Los SDKs son para <strong>backend</strong>: nunca expongas <code className="text-xs bg-muted px-1 rounded">client_secret</code> ni <code className="text-xs bg-muted px-1 rounded">secretAccessKey</code> en el navegador.</li>
                <li>La firma ZYN1 tolera un desfase de reloj de 5 minutos: sincroniza la hora del servidor.</li>
                <li>El upload carga el archivo en memoria del API — para archivos muy grandes considera trocearlos.</li>
                <li>Los nombres de bucket se normalizan a minúsculas y guiones.</li>
                <li>Cada usuario/Access Key solo ve y gestiona sus propios buckets.</li>
                <li>El <code className="text-xs bg-muted px-1 rounded">refresh_token</code> de ZynAuth dura 30 días; el access token 1 hora.</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/apps">Registrar una app <KeyRound /></Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/access-keys">Crear Access Key <KeyRound /></Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/storage">Ir a Object Storage <ExternalLink /></Link>
                </Button>
              </div>
            </Section>
          </div>
        </div>
      </PageShell>
    </>
  )
}
