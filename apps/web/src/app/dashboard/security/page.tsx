"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
      <div className="w-full max-w-3xl px-4 py-6 sm:px-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Verificación en dos pasos (MFA)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Añade una segunda capa de seguridad a tu cuenta con una app de autenticación (TOTP).
          </p>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Estado */}
            <div className="rounded-lg border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status?.enabled ? (
                  <ShieldCheck className="w-8 h-8 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-amber-500" />
                )}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    MFA {status?.enabled ? "activado" : "desactivado"}
                    <Badge variant={status?.enabled ? "default" : "secondary"}>
                      {status?.enabled ? "Protegido" : "Sin protección"}
                    </Badge>
                  </div>
                  {status?.enabled && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {status.backupCodesRemaining} códigos de respaldo restantes
                    </p>
                  )}
                </div>
              </div>
              {status?.enabled ? (
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setShowDisable(true)}>
                  Desactivar
                </Button>
              ) : (
                !setupData && (
                  <Button onClick={startSetup} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Activar MFA
                  </Button>
                )
              )}
            </div>

            {/* Setup wizard */}
            {setupData && (
              <div className="rounded-lg border p-5 space-y-4">
                <h3 className="font-medium">1. Escanea el código QR</h3>
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  <div className="rounded-lg bg-white p-3 shrink-0">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="QR MFA" width={180} height={180} />
                    ) : (
                      <div className="w-[180px] h-[180px] grid place-items-center">
                        <Loader2 className="w-5 h-5 animate-spin text-black" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Usa Google Authenticator, Authy o 1Password. ¿No puedes escanear? Ingresa esta clave manualmente:
                    </p>
                    <code className="block rounded bg-muted px-3 py-2 font-mono text-xs break-all">{setupData.secret}</code>
                  </div>
                </div>
                <h3 className="font-medium pt-2">2. Ingresa el código de 6 dígitos</h3>
                <div className="flex gap-2 max-w-xs">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    className="font-mono tracking-widest text-center text-lg"
                    onKeyDown={(e) => e.key === "Enter" && confirmEnable()}
                    autoFocus
                  />
                  <Button onClick={confirmEnable} disabled={busy || code.length < 6}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSetupData(null)}>
                  Cancelar
                </Button>
              </div>
            )}

            {/* Backup codes */}
            {backupCodes && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <h3 className="font-medium">Códigos de respaldo</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guárdalos en un lugar seguro. Cada uno sirve una vez si pierdes tu teléfono. No se volverán a mostrar.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((c) => (
                    <div key={c} className="rounded bg-background border px-3 py-1.5 text-center">{c}</div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={copyBackup}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiado" : "Copiar todos"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

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
            className="font-mono"
            onKeyDown={(e) => e.key === "Enter" && disableMfa()}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowDisable(false); setDisableCode("") }}>Cancelar</Button>
            <Button variant="destructive" onClick={disableMfa} disabled={busy || disableCode.length < 6}>
              {busy ? "..." : "Desactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
