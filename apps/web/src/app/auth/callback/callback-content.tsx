"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Logo } from "@/components/brand/logo"

export default function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      localStorage.setItem("token", token)
      router.replace("/dashboard")
    } else {
      router.replace("/?google=error")
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 login-canvas">
      <Logo size={32} />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Completando inicio de sesión…
      </div>
    </div>
  )
}
