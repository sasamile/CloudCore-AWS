"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { Moon, Sun, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Logo } from "@/components/brand/logo"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"

type Step = "credentials" | "mfa"

export default function LoginPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [step, setStep] = useState<Step>("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [mfaTicket, setMfaTicket] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

  useEffect(() => {
    const msg = sessionStorage.getItem("auth_error")
    if (msg) {
      setError(msg)
      toast({ title: "Sesión expirada", description: msg, variant: "destructive" })
      sessionStorage.removeItem("auth_error")
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get("google") === "error") {
      const googleMsg =
        "No se pudo completar el inicio de sesión con Google. Revisa la configuración OAuth."
      setError(googleMsg)
      toast({ title: "Google", description: googleMsg, variant: "destructive" })
      window.history.replaceState({}, "", "/")
    }

    const ticket = params.get("ticket")
    if (params.get("mfa") === "1" && ticket) {
      setMfaTicket(ticket)
      setStep("mfa")
      window.history.replaceState({}, "", "/")
    }
  }, [])

  function finishWithToken(token: string) {
    localStorage.setItem("token", token)
    toast({ title: "Bienvenido", description: "Entrando al panel…" })
    router.push("/dashboard")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (isRegister) {
        const regRes = await fetch(`${API_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        })
        if (!regRes.ok) {
          const d = await regRes.json()
          const msg = formatApiError(d.message, "No se pudo registrar")
          setError(msg)
          toast({ title: "Registro", description: msg, variant: "destructive" })
          return
        }
      }

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = formatApiError(data.message, "Credenciales inválidas")
        setError(msg)
        toast({ title: "Inicio de sesión", description: msg, variant: "destructive" })
        return
      }

      if (data.mfaRequired && data.mfaTicket) {
        setMfaTicket(data.mfaTicket)
        setMfaCode("")
        setStep("mfa")
        return
      }

      if (!data.access_token) {
        const msg = "El servidor no devolvió un token"
        setError(msg)
        toast({ title: "Inicio de sesión", description: msg, variant: "destructive" })
        return
      }
      finishWithToken(data.access_token)
    } catch {
      const msg = "No se pudo conectar con el servidor"
      setError(msg)
      toast({ title: "Error de conexión", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/mfa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: mfaTicket, code: mfaCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = formatApiError(data.message, "Código inválido")
        setError(msg)
        toast({ title: "Verificación MFA", description: msg, variant: "destructive" })
        return
      }
      if (!data.access_token) {
        setError("El servidor no devolvió un token")
        return
      }
      finishWithToken(data.access_token)
    } catch {
      const msg = "No se pudo conectar con el servidor"
      setError(msg)
      toast({ title: "Error de conexión", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/integrations/google/authorize`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = formatApiError(data.message, "Google OAuth no configurado")
        setError(msg)
        toast({ title: "Google", description: msg, variant: "destructive" })
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error("Google OAuth no configurado")
    } catch {
      const msg = "No se pudo iniciar sesión con Google"
      setError(msg)
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col login-canvas relative">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-background/70" />

      <div className="flex-1 flex items-center justify-center px-4 py-16 relative z-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 text-center space-y-3">
            <div className="inline-flex justify-center">
              <Logo size={36} />
            </div>
            {step === "credentials" ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {isRegister ? "Crear cuenta" : "Entrar a ZynCloud"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isRegister
                    ? "Regístrate para administrar tu infraestructura."
                    : "Usa tu cuenta de consola para continuar."}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">Verificación MFA</h1>
                <p className="text-sm text-muted-foreground">
                  Introduce el código de tu autenticador o un código de respaldo.
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur-sm">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "credentials" ? (
              <div className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isRegister && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        required={isRegister}
                        className="h-10"
                        autoComplete="name"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@empresa.com"
                      required
                      className="h-10"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="h-10"
                      autoComplete={isRegister ? "new-password" : "current-password"}
                    />
                  </div>
                  <Button type="submit" className="w-full h-10" disabled={loading}>
                    {loading ? "…" : isRegister ? "Crear cuenta" : "Continuar"}
                  </Button>
                </form>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">o</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  disabled={loading}
                  onClick={handleGoogleLogin}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continuar con Google
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister)
                      setError("")
                    }}
                    className="underline-offset-4 hover:underline hover:text-foreground transition-colors duration-150"
                  >
                    {isRegister
                      ? "¿Ya tienes cuenta? Inicia sesión"
                      : "¿No tienes cuenta? Regístrate"}
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Código de verificación</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    required
                    minLength={6}
                    maxLength={11}
                    className="h-10 font-mono tracking-widest text-center text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    6 dígitos del autenticador, o un código de respaldo.
                  </p>
                </div>
                <Button type="submit" className="w-full h-10" disabled={loading || mfaCode.trim().length < 6}>
                  {loading ? "Verificando…" : "Verificar y entrar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-9 text-muted-foreground"
                  disabled={loading}
                  onClick={() => {
                    setStep("credentials")
                    setMfaTicket("")
                    setMfaCode("")
                    setError("")
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Volver
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
        <p className="text-xs text-muted-foreground">ZynCloud Console</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 text-muted-foreground"
          aria-label="Cambiar tema"
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
