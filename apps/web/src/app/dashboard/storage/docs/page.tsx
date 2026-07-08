"use client"

import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, BookOpen, Copy, Check, ExternalLink } from "lucide-react"
import { useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-lg border overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
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
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
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
      <h2 className="text-lg font-semibold border-b pb-2">{title}</h2>
      {children}
    </section>
  )
}

const toc = [
  { id: "overview", label: "Descripción general" },
  { id: "concepts", label: "Conceptos" },
  { id: "auth", label: "Autenticación" },
  { id: "endpoints", label: "Endpoints" },
  { id: "examples", label: "Ejemplos" },
  { id: "delete", label: "Eliminación" },
  { id: "limits", label: "Límites" },
]

export default function StorageDocsPage() {
  return (
    <>
      <Header
        title="Object Storage API"
        breadcrumbs={[
          { label: "Storage", href: "/dashboard/storage" },
          { label: "Documentación" },
        ]}
      />
      <div className="w-full px-4 py-6 sm:px-6 space-y-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar TOC */}
          <nav className="lg:w-48 shrink-0">
            <div className="lg:sticky lg:top-20 space-y-1">
              <Button variant="ghost" size="sm" asChild className="w-full justify-start -ml-2 mb-3 text-muted-foreground">
                <Link href="/dashboard/storage">
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver a Storage
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

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
                <h1 className="text-2xl font-semibold tracking-tight">Object Storage API</h1>
              </div>
              <p className="text-muted-foreground">
                Almacenamiento de archivos estilo S3 en ZynCloud. Usa buckets y objetos desde tu app,
                scripts o cualquier cliente HTTP con un token JWT.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">REST API</Badge>
                <Badge variant="secondary">JWT Auth</Badge>
                <Badge variant="secondary">Multipart upload</Badge>
              </div>
            </div>

            <Section id="overview" title="Descripción general">
              <p className="text-sm text-muted-foreground leading-relaxed">
                ZynCloud Object Storage guarda tus archivos en el servidor bajo{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">STORAGE_DIR</code>.
                Cada usuario tiene sus propios buckets aislados. La API es compatible con el flujo
                habitual de S3: crear bucket → subir objetos → listar → descargar → eliminar.
              </p>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm font-mono">
                {API_URL}/storage/buckets
              </div>
            </Section>

            <Section id="concepts" title="Conceptos">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    term: "Bucket",
                    desc: "Contenedor lógico, como una carpeta raíz. Nombre en minúsculas (ej. mi-app-assets).",
                  },
                  {
                    term: "Object",
                    desc: "Un archivo dentro del bucket. Tiene una key (ruta/nombre) y metadata.",
                  },
                  {
                    term: "Key",
                    desc: "Identificador del objeto dentro del bucket. Ej: fotos/avatar.png",
                  },
                ].map((item) => (
                  <div key={item.term} className="rounded-lg border p-4 space-y-1">
                    <p className="font-medium text-sm">{item.term}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Ruta en disco:{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  STORAGE_DIR/{"{userId}"}/{"{bucket}"}/{"{key}"}
                </code>
              </p>
            </Section>

            <Section id="auth" title="Autenticación">
              <p className="text-sm text-muted-foreground">
                Todas las peticiones requieren un token JWT en el header{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer TOKEN</code>.
                Obtén el token con login:
              </p>
              <CodeBlock
                title="Obtener token"
                code={`curl -X POST ${API_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"tu@email.com","password":"tu-password"}'

# Respuesta: { "access_token": "eyJhbG..." }`}
              />
            </Section>

            <Section id="endpoints" title="Endpoints">
              <div className="overflow-x-auto rounded-lg border">
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
                      ["GET", "/storage/buckets", "Listar buckets"],
                      ["POST", "/storage/buckets", "Crear bucket"],
                      ["DELETE", "/storage/buckets/:id", "Eliminar bucket y todos sus objetos"],
                      ["GET", "/storage/buckets/:id/objects", "Listar objetos"],
                      ["POST", "/storage/buckets/:id/upload", "Subir archivo (multipart)"],
                      ["GET", "/storage/buckets/:bucketId/objects/:objectId/download", "Descargar objeto"],
                      ["DELETE", "/storage/buckets/:bucketId/objects/:objectId", "Eliminar objeto"],
                    ].map(([method, path, desc]) => (
                      <tr key={path} className="hover:bg-muted/30">
                        <td className="p-4">
                          <Badge variant={method === "GET" ? "secondary" : method === "DELETE" ? "destructive" : "default"} className="font-mono text-[10px]">
                            {method}
                          </Badge>
                        </td>
                        <td className="p-4 font-mono text-xs">{path}</td>
                        <td className="p-4 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="examples" title="Ejemplos">
              <div className="space-y-6">
                <CodeBlock
                  title="1. Crear bucket"
                  code={`curl -X POST ${API_URL}/storage/buckets \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"mi-bucket"}'`}
                />
                <CodeBlock
                  title="2. Subir archivo"
                  code={`curl -X POST ${API_URL}/storage/buckets/BUCKET_ID/upload \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@./imagen.png" \\
  -F "key=fotos/imagen.png"`}
                />
                <CodeBlock
                  title="3. Listar objetos"
                  code={`curl ${API_URL}/storage/buckets/BUCKET_ID/objects \\
  -H "Authorization: Bearer $TOKEN"`}
                />
                <CodeBlock
                  title="4. Descargar objeto"
                  code={`curl -O ${API_URL}/storage/buckets/BUCKET_ID/objects/OBJECT_ID/download \\
  -H "Authorization: Bearer $TOKEN"`}
                />
                <CodeBlock
                  title="5. Eliminar objeto"
                  code={`curl -X DELETE ${API_URL}/storage/buckets/BUCKET_ID/objects/OBJECT_ID \\
  -H "Authorization: Bearer $TOKEN"`}
                />
                <CodeBlock
                  title="JavaScript (fetch)"
                  code={`const token = "eyJhbG..."
const bucketId = "clx..."

// Subir archivo
const form = new FormData()
form.append("file", fileInput.files[0])
form.append("key", "uploads/archivo.pdf")

const res = await fetch(\`${API_URL}/storage/buckets/\${bucketId}/upload\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${token}\` },
  body: form,
})
const object = await res.json()
console.log(object)`}
                />
                <CodeBlock
                  title="Python (requests)"
                  code={`import requests

token = "eyJhbG..."
bucket_id = "clx..."
headers = {"Authorization": f"Bearer {token}"}

# Subir
with open("archivo.pdf", "rb") as f:
    r = requests.post(
        f"${API_URL}/storage/buckets/{bucket_id}/upload",
        headers=headers,
        files={"file": f},
        data={"key": "docs/archivo.pdf"},
    )
print(r.json())`}
                />
              </div>
            </Section>

            <Section id="delete" title="Eliminación y sincronización">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cuando eliminas un objeto o bucket desde la consola o la API, el archivo se borra
                <strong className="text-foreground"> del disco del servidor</strong> y de la base de datos
                al mismo tiempo. No quedan archivos huérfanos en el servidor si la operación tiene éxito.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Eliminar objeto → borra el archivo y el registro en PostgreSQL</li>
                <li>Eliminar bucket → borra la carpeta completa del bucket en disco</li>
                <li>Subir con la misma key → sobrescribe el archivo existente (upsert)</li>
              </ul>
            </Section>

            <Section id="limits" title="Límites y notas">
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>No es AWS S3 real — no hay access keys ni SDK de AWS</li>
                <li>Autenticación solo con JWT (mismo login de la consola)</li>
                <li>Los nombres de bucket se normalizan a minúsculas y guiones</li>
                <li>El upload carga el archivo en memoria del API — archivos muy grandes pueden requerir más RAM</li>
                <li>Cada usuario solo ve y gestiona sus propios buckets</li>
              </ul>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/storage">
                    Ir a Object Storage <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </>
  )
}
