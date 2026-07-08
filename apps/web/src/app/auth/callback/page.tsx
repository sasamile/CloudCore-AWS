"use client"

import { Suspense } from "react"
import AuthCallbackContent from "./callback-content"

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackContent />
    </Suspense>
  )
}
