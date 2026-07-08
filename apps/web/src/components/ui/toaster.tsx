"use client"

import { Toaster as HotToaster } from "react-hot-toast"

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      gutter={12}
      toastOptions={{
        duration: 4000,
        className:
          "!rounded-lg !border !border-border !bg-card !text-foreground !text-sm !shadow-lg",
        success: {
          iconTheme: {
            primary: "hsl(var(--primary))",
            secondary: "hsl(var(--primary-foreground))",
          },
        },
        error: {
          className:
            "!rounded-lg !border !border-destructive/50 !bg-destructive !text-destructive-foreground !text-sm !shadow-lg",
        },
      }}
    />
  )
}
