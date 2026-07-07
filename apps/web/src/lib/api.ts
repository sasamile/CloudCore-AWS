import { formatApiError } from "./format-api-error"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function getToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      sessionStorage.setItem("auth_error", "Your session expired. Please sign in again.")
      window.location.href = "/"
    }
    throw new Error("No autorizado")
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(formatApiError(data.message, `Error ${res.status}`))
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
}
