"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { Moon, Sun, Cloud } from "lucide-react"

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
          setError(d.message || "Registration failed")
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
        setError(data.message || "Invalid credentials")
        return
      }
      localStorage.setItem("token", data.access_token)
      router.push("/dashboard")
    } catch {
      setError("Could not connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2">
            <Cloud className="w-8 h-8" />
            <h1 className="text-xl font-semibold tracking-tight">
              {isRegister ? "Create an account" : "Sign in to ZynCloud"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRegister ? "Enter your details below" : "Enter your credentials below"}
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Your name"
                  required={isRegister}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 w-full"
            >
              {loading ? "Loading..." : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError("") }}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">ZynCloud Console</p>
        <button
          onClick={toggleTheme}
          className="inline-flex items-center justify-center rounded-md w-8 h-8 hover:bg-accent transition-colors text-muted-foreground"
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
