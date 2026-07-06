import { io, Socket } from "socket.io-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
