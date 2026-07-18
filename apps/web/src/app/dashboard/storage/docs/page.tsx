"use client"

import Link from "next/link"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  HardDrive,
  ShieldCheck,
  BookOpen,
  Terminal,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function MethodBadge({ method }: { method: string }) {
  const styles =
    method === "GET"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
      : method === "DELETE"
        ? "bg-destructive/10 text-destructive border-destructive/25"
        : method === "POST"
          ? "bg-foreground/90 text-background border-transparent"
          : "bg-muted text-muted-foreground border-border"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
        styles,
      )}
    >
      {method}
    </span>
  )
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {title && (
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/60">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{title}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background transition-colors duration-150"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed bg-muted/30 text-foreground/90 dark:bg-background">
        {code}
      </pre>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <span className="h-5 w-1 rounded-full bg-foreground" aria-hidden />
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:bg-muted/30 transition-colors duration-150">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
          <Icon className="h-4 w-4" />
        </div>
        <p className="font-medium text-sm">{title}</p>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
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
        title="API Docs"
        breadcrumbs={[{ label: "Storage", href: "/dashboard/storage" }]}
      />
      <PageShell maxWidth="full">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <nav className="lg:w-52 shrink-0">
            <div className="lg:sticky lg:top-20 space-y-1">
              <Button
                variant="ghost"
                asChild
                className="w-full justify-start -ml-1 mb-3 h-9 text-sm text-muted-foreground"
              >
                <Link href="/dashboard/storage">
                  <ArrowLeft className="w-3.5 h-3.5" /> Storage
                </Link>
              </Button>
              <div className="rounded-2xl border border-border bg-card p-2">
                <p className="px-2 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  En esta página
                </p>
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors duration-150"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </nav>

          <div className="flex-1 min-w-0 space-y-10">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                Developer docs
              </div>
              <PageHeader
                title="API para Desarrolladores"
                description="ZynCloud como mini-AWS: identidad (ZynAuth) y almacenamiento (Object Storage), con SDKs en npm. Registra tu app, autentica usuarios y guarda archivos en minutos."
              />
              <div className="flex flex-wrap gap-2">
                {["@zyntek/zynauth", "@zyntek/storage", "OIDC", "Firma ZYN1", "REST"].map(
                  (label) => (
                    <Badge key={label} variant="secondary" className="font-mono text-[10px]">
                      {label}
                    </Badge>
                  ),
                )}
              </div>
            </div>

            <Section id="overview" title="Descripción general">
              <div className="grid gap-4 sm:grid-cols-2">
                <FeatureCard icon={ShieldCheck} title="ZynAuth — Identidad">
                  Cada app registrada tiene su propio <strong className="text-foreground">pool de usuarios</strong>{" "}
                  (como Cognito). Login embebido con MFA, OIDC estándar y SSO. SDK:{" "}
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono">@zyntek/zynauth</code>.
                </FeatureCard>
                <FeatureCard icon={HardDrive} title="Object Storage — Archivos">
                  Buckets y objetos estilo S3. Acceso por <strong className="text-foreground">Access Key + Secret</strong>{" "}
                  con firma ZYN1, igual que AWS. SDK:{" "}
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono">@zyntek/storage</code>.
                </FeatureCard>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-mono flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Base URL
                </span>
                <span className="text-foreground break-all">{API_URL}</span>
              </div>
            </Section>

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
                Ambos funcionan en el backend (Node 18+). Las credenciales (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">client_secret</code>,{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">secretAccessKey</code>) viven solo
                en el servidor.
              </p>
            </Section>

            <Section id="auth" title="Autenticación (ZynAuth)">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Registra tu app en{" "}
                <Link
                  href="/dashboard/apps"
                  className="font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Apps
                </Link>{" "}
                y obtén{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">client_id</code> y{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">client_secret</code>. El SDK hace
                login embebido (sin redirect) y maneja MFA por ti — como Amplify con Cognito.
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
                Guarda los tokens en la sesión del servidor (patrón BFF), no en el navegador. Para registrar usuarios
                desde tu app:
              </p>
              <CodeBlock title="Registro" code={`await zynauth.register(email, password, 'Nombre Apellido');`} />
            </Section>

            <Section id="pools" title="Pools de usuarios">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cada app tiene su <strong className="text-foreground">propio directorio de usuarios</strong>, aislado
                del resto y de los administradores de ZynCloud — exactamente como los User Pools de Cognito. Los
                gestionas desde{" "}
                <Link
                  href="/dashboard/apps"
                  className="font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Apps → Usuarios
                </Link>
                : crear, listar, resetear contraseña y eliminar.
              </p>
              <ul className="space-y-2.5">
                {[
                  <>
                    El login valida contra el pool del{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">client_id</code> de tu app.
                  </>,
                  <>
                    Los access tokens llevan{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">
                      user_source: &quot;app&quot;
                    </code>{" "}
                    para distinguirlos.
                  </>,
                  <>Bloqueo automático tras 5 intentos fallidos (15 min).</>,
                ].map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="storage" title="Object Storage (S3)">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { term: "Bucket", desc: "Contenedor lógico. Nombre en minúsculas (ej. orbidev-assets)." },
                  { term: "Object", desc: "Un archivo dentro del bucket. Tiene una key y metadata." },
                  { term: "Key", desc: "Ruta/nombre del objeto. Ej: avatars/u1.png" },
                ].map((item) => (
                  <div key={item.term} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-foreground" />
                      {item.term}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Flujo típico: crear Access Key → crear bucket → subir → listar → descargar → eliminar. Dos formas de
                autenticar: <strong className="text-foreground">JWT</strong> (consola) o{" "}
                <strong className="text-foreground">Access Key + firma ZYN1</strong> (apps y scripts).
              </p>
            </Section>

            <Section id="keys" title="Access Keys (firma ZYN1)">
              <p className="text-sm text-muted-foreground leading-relaxed">
                En{" "}
                <Link
                  href="/dashboard/access-keys"
                  className="font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Access Keys
                </Link>{" "}
                crea una credencial. Obtienes un{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">ZYNAK...</code> y un secret que
                se muestra <strong className="text-foreground">una sola vez</strong>.
              </p>
              <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1.5 text-xs font-mono">
                <div className="text-foreground/90">
                  Authorization: ZYN1-HMAC-SHA256 Credential=&lt;accessKeyId&gt;, Signature=&lt;hmac&gt;
                </div>
                <div className="text-foreground/90">X-Zyn-Date: &lt;ISO8601&gt;</div>
                <div className="text-foreground/90">X-Zyn-Content-Sha256: UNSIGNED-PAYLOAD</div>
              </div>
              <p className="text-sm text-muted-foreground">
                La firma ={" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">
                  HMAC-SHA256(secret, &quot;METHOD\\nPATH\\nDATE\\nCONTENT_SHA&quot;)
                </code>
                . El SDK{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">@zyntek/storage</code> lo hace por
                ti.
              </p>
            </Section>

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
                Si prefieres HTTP directo (sin SDK), firma tú la petición o usa un JWT:
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

            <Section id="endpoints" title="Referencia REST">
              <p className="text-sm font-medium">Autenticación</p>
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Método</th>
                      <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Ruta</th>
                      <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["POST", "/zynauth/auth/login", "Login embebido → tokens o challenge MFA"],
                      ["POST", "/zynauth/auth/mfa", "Completar el reto de MFA"],
                      ["POST", "/zynauth/register", "Auto-registro de usuario en el pool"],
                      ["POST", "/oauth2/token", "OIDC: authorization_code + refresh_token"],
                      ["GET", "/oauth2/userinfo", "Datos del usuario (Bearer)"],
                      ["GET", "/.well-known/openid-configuration", "Discovery OIDC"],
                    ].map(([method, path, desc]) => (
                      <tr key={path} className="hover:bg-muted/40 transition-colors duration-150">
                        <td className="px-4 py-3">
                          <MethodBadge method={method} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{path}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-sm font-medium pt-2">Storage &amp; Access Keys</p>
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Método</th>
                      <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Ruta</th>
                      <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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
                      <tr key={path} className="hover:bg-muted/40 transition-colors duration-150">
                        <td className="px-4 py-3">
                          <MethodBadge method={method} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{path}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="notes" title="Notas y límites">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                {[
                  <>
                    Los SDKs son para <strong className="text-foreground">backend</strong>: nunca expongas{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">client_secret</code> ni{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">secretAccessKey</code> en el
                    navegador.
                  </>,
                  <>La firma ZYN1 tolera un desfase de reloj de 5 minutos: sincroniza la hora del servidor.</>,
                  <>El upload carga el archivo en memoria del API — para archivos muy grandes considera trocearlos.</>,
                  <>Los nombres de bucket se normalizan a minúsculas y guiones.</>,
                  <>Cada usuario/Access Key solo ve y gestiona sus propios buckets.</>,
                  <>
                    El <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">refresh_token</code> de
                    ZynAuth dura 30 días; el access token 1 hora.
                  </>,
                ].map((item, i) => (
                  <div key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild className="h-9">
                  <Link href="/dashboard/apps">
                    Registrar una app <KeyRound className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild className="h-9">
                  <Link href="/dashboard/access-keys">
                    Crear Access Key <KeyRound className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild className="h-9">
                  <Link href="/dashboard/storage">
                    Ir a Object Storage <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Section>
          </div>
        </div>
      </PageShell>
    </>
  )
}
