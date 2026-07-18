"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  KeyRound,
} from "lucide-react"

interface MfaStatus {
  enabled: boolean
  backupCodesRemaining: number
}

export default function SecurityPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [showDisable, setShowDisable] = useState(false)
  const [disableCode, setDisableCode] = useState("")

  async function load() {
    setLoading(true)
    try {
      setStatus(await api.get<MfaStatus>("/zynauth/mfa/status"))
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (setupData?.otpauthUri) {
      QRCode.toDataURL(setupData.otpauthUri, { margin: 1, width: 200 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null))
    }
  }, [setupData])

  async function startSetup() {
    setBusy(true)
    try {
      const data = await api.post<{ secret: string; otpauthUri: string }>("/zynauth/mfa/setup")
      setSetupData(data)
      setBackupCodes(null)
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable() {
    if (code.trim().length < 6) return
    setBusy(true)
    try {
      const res = await api.post<{ enabled: boolean; backupCodes: string[] }>("/zynauth/mfa/enable", { code: code.trim() })
      setBackupCodes(res.backupCodes)
      setSetupData(null)
      setCode("")
      await load()
      toast({ title: "MFA activado", description: "Guarda tus códigos de respaldo." })
    } catch (err) {
      toast({ title: "Código inválido", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function disableMfa() {
    setBusy(true)
    try {
      await api.post("/zynauth/mfa/disable", { code: disableCode.trim() })
      setShowDisable(false)
      setDisableCode("")
      await load()
      toast({ title: "MFA desactivado" })
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  function copyBackup() {
    if (!backupCodes) return
    navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <Header title="Seguridad" breadcrumbs={[{ label: "Identity" }, { label: "Security" }]} />
      <PageShell maxWidth="full">
        <PageHeader
          title="Verificación en dos pasos (MFA)"
          description="Añade una segunda capa de seguridad a tu cuenta con una app de autenticación (TOTP)."
        />

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-9 w-28 shrink-0" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                  {status?.enabled ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">MFA {status?.enabled ? "activado" : "desactivado"}</span>
                    <Badge variant={status?.enabled ? "default" : "secondary"}>
                      {status?.enabled ? "Protegido" : "Sin protección"}
                    </Badge>
                  </div>
                  {status?.enabled && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {status.backupCodesRemaining} códigos de respaldo restantes
                    </p>
                  )}
                </div>
              </div>
              {status?.enabled ? (
                <Button
                  variant="outline"
                  className="h-9 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setShowDisable(true)}
                >
                  Desactivar
                </Button>
              ) : (
                !setupData && (
                  <Button className="h-9 shrink-0" onClick={startSetup} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Activar MFA
                  </Button>
                )
              )}
            </div>

            {setupData && (
              <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-medium">1. Escanea el código QR</h3>
                  <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="rounded-xl border border-border bg-background p-3 shrink-0">
                      {qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUrl} alt="QR MFA" width={180} height={180} />
                      ) : (
                        <div className="grid h-[180px] w-[180px] place-items-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        Usa Google Authenticator, Authy o 1Password. ¿No puedes escanear? Ingresa esta clave manualmente:
                      </p>
                      <code className="block rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
                        {setupData.secret}
                      </code>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium">2. Ingresa el código de 6 dígitos</h3>
                  <div className="mt-3 flex gap-2 max-w-xs">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      className="h-9 font-mono tracking-widest text-center text-lg"
                      onKeyDown={(e) => e.key === "Enter" && confirmEnable()}
                      autoFocus
                    />
                    <Button className="h-9" onClick={confirmEnable} disabled={busy || code.length < 6}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" className="h-9 px-3" onClick={() => setSetupData(null)}>
                  Cancelar
                </Button>
              </div>
            )}

            {backupCodes && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-medium">Códigos de respaldo</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guárdalos en un lugar seguro. Cada uno sirve una vez si pierdes tu teléfono. No se volverán a mostrar.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((c) => (
                    <div key={c} className="rounded-lg border border-border bg-background px-3 py-1.5 text-center">
                      {c}
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="h-9" onClick={copyBackup}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar todos"}
                </Button>
              </div>
            )}
          </div>
        )}
      </PageShell>

      <Dialog open={showDisable} onOpenChange={(o) => { if (!o) { setShowDisable(false); setDisableCode("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Desactivar MFA?</DialogTitle>
            <DialogDescription>
              Tu cuenta quedará sin segundo factor. Ingresa un código actual de tu app (o de respaldo) para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.trim())}
            placeholder="Código de 6 dígitos o de respaldo"
            className="h-9 font-mono"
            onKeyDown={(e) => e.key === "Enter" && disableMfa()}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => { setShowDisable(false); setDisableCode("") }}>Cancelar</Button>
            <Button variant="destructive" className="h-9" onClick={disableMfa} disabled={busy || disableCode.length < 6}>
              {busy ? "..." : "Desactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
