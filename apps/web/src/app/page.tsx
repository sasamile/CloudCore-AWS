"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Logo } from "@/components/brand/logo"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"

export default function LoginPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

  useEffect(() => {
    const msg = sessionStorage.getItem("auth_error")
    if (msg) {
      setError(msg)
      toast({ title: "Session expired", description: msg, variant: "destructive" })
      sessionStorage.removeItem("auth_error")
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get("google") === "error") {
      const googleMsg = "No se pudo completar el inicio de sesión con Google. Revisa la configuración OAuth."
      setError(googleMsg)
      toast({ title: "Google login", description: googleMsg, variant: "destructive" })
      window.history.replaceState({}, "", "/")
    }
  }, [])

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
          const msg = formatApiError(d.message, "Registration failed")
          setError(msg)
          toast({ title: "Registration failed", description: msg, variant: "destructive" })
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
        const msg = formatApiError(data.message, "Invalid credentials")
        setError(msg)
        toast({ title: "Sign in failed", description: msg, variant: "destructive" })
        return
      }
      if (!data.access_token) {
        const msg = "Server did not return a token"
        setError(msg)
        toast({ title: "Sign in failed", description: msg, variant: "destructive" })
        return
      }
      localStorage.setItem("token", data.access_token)
      toast({ title: "Welcome back", description: "Redirecting to dashboard..." })
      router.push("/dashboard")
    } catch {
      const msg = "Could not connect to server"
      setError(msg)
      toast({ title: "Connection error", description: msg, variant: "destructive" })
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
        const msg = formatApiError(data.message, "Google OAuth no configurado en el servidor")
        setError(msg)
        toast({ title: "Google login", description: msg, variant: "destructive" })
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error("Google OAuth no configurado")
    } catch {
      const msg = "No se pudo conectar con el servidor para iniciar sesión con Google"
      setError(msg)
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col login-canvas relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <Card className="w-full max-w-sm border-border/80 shadow-2xl bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto">
              <Logo size={40} />
            </div>
            <CardTitle className="text-xl">
              {isRegister ? "Create an account" : "Sign in to ZynCloud"}
            </CardTitle>
            <CardDescription>
              {isRegister ? "Enter your details to get started" : "Enter your credentials to continue"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required={isRegister}
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
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Loading..." : isRegister ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o continúa con</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogleLogin}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
          </CardContent>

          <CardFooter className="justify-center border-t pt-4">
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError("") }}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </CardFooter>
        </Card>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background">
        <p className="text-xs text-muted-foreground">ZynCloud Console</p>
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
