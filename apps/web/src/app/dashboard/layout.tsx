"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNavProvider } from "@/components/layout/mobile-nav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
    }
  }, [router])

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:ml-60 brand-mesh min-h-screen min-w-0">{children}</main>
      </div>
    </MobileNavProvider>
  )
}
