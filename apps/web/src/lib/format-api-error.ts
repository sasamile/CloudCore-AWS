export function formatApiError(message: unknown, fallback = "Something went wrong"): string {
  if (Array.isArray(message)) return message.join(", ")
  if (typeof message === "string" && message.length > 0) return message
  return fallback
}
