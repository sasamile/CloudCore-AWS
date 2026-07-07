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
