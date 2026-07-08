"use client"

import hotToast from "react-hot-toast"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

function messageFrom({ title, description }: ToastProps) {
  if (title && description) return `${title}: ${description}`
  return title || description || ""
}

export function toast(props: ToastProps) {
  const message = messageFrom(props)
  if (props.variant === "destructive") {
    hotToast.error(message)
  } else {
    hotToast.success(message)
  }
}

export function useToast() {
  return { toast, toasts: [] as ToastProps[] }
}
