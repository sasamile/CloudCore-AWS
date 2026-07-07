"use client"

import * as React from "react"

type ToastProps = {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

type ToastState = {
  toasts: ToastProps[]
}

const listeners = new Set<(state: ToastState) => void>()
let memoryState: ToastState = { toasts: [] }

function dispatch(toasts: ToastProps[]) {
  memoryState = { toasts }
  listeners.forEach((listener) => listener(memoryState))
}

export function toast(props: Omit<ToastProps, "id">) {
  const id = crypto.randomUUID()
  dispatch([...memoryState.toasts, { ...props, id }])
  setTimeout(() => {
    dispatch(memoryState.toasts.filter((t) => t.id !== id))
  }, 4000)
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return { toasts: state.toasts, toast }
}
