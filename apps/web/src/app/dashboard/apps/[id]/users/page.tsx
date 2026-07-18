"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Users, Plus, Loader2, Trash2, KeyRound, ChevronLeft } from "lucide-react"

interface AppUser {
  id: string
  clientId: string
  email: string
  name: string | null
  emailVerified: boolean
  mfaEnabled: boolean
  createdAt: string
}

export default function AppUsersPage() {
  const params = useParams()
  const clientId = params.id as string

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null)
  const [busy, setBusy] = useState(false)

  // form create
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  // form reset password
  const [newPassword, setNewPassword] = useState("")

  async function load() {
    setLoading(true)
    try {
      setUsers(await api.get<AppUser[]>(`/zynauth/clients/${clientId}/users`))
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [clientId])

  function resetCreateForm() {
    setEmail(""); setName(""); setPassword("")
  }

  async function createUser() {
    if (!email.trim() || !password) {
      toast({ title: "Faltan datos", description: "Email y contraseña son obligatorios.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await api.post(`/zynauth/clients/${clientId}/users`, { email: email.trim(), name: name.trim() || undefined, password })
      setShowCreate(false)
      resetCreateForm()
      await load()
      toast({ title: "Usuario creado" })
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!resetTarget || !newPassword) return
    setBusy(true)
    try {
      await api.patch(`/zynauth/clients/${clientId}/users/${resetTarget.id}/reset-password`, { newPassword })
      setResetTarget(null)
      setNewPassword("")
      toast({ title: "Contraseña actualizada" })
    } catch (err) {
      toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header
        title="Usuarios de la app"
        breadcrumbs={[{ label: "Identity" }, { label: "Apps" }, { label: "Usuarios" }]}
      />
      <div className="w-full max-w-4xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard/apps" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-3.5 h-3.5" /> Apps
              </Link>
            </div>
            <h2 className="text-xl font-semibold">Pool de usuarios</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Usuarios registrados en este app client · <code className="font-mono text-xs">{clientId}</code>
            </p>
          </div>
          <Button size="sm" onClick={() => { resetCreateForm(); setShowCreate(true) }}>
            <Plus className="w-3.5 h-3.5" /> Añadir usuario
          </Button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Sin usuarios todavía. Puedes crearlos aquí o dejar que se registren solos desde la Hosted UI.
            </p>
            <Button size="sm" onClick={() => { resetCreateForm(); setShowCreate(true) }}>
              <Plus className="w-3.5 h-3.5" /> Crear el primero
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{u.email}</span>
                    {u.emailVerified && <Badge variant="secondary" className="text-xs">verificado</Badge>}
                    {u.mfaEnabled && <Badge variant="outline" className="text-xs">MFA</Badge>}
                  </div>
                  {u.name && <p className="text-xs text-muted-foreground mt-0.5">{u.name}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(u.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Resetear contraseña" onClick={() => { setResetTarget(u); setNewPassword("") }}>
                    <KeyRound className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(u)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crear usuario */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetCreateForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir usuario</DialogTitle>
            <DialogDescription>El usuario podrá iniciar sesión con estas credenciales desde la app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Nombre (opcional)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Contraseña temporal</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" minLength={6} />
              <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm() }}>Cancelar</Button>
            <Button onClick={createUser} disabled={busy}>{busy ? "..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>{resetTarget?.email}</DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Nueva contraseña</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" minLength={6} autoFocus />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword("") }}>Cancelar</Button>
            <Button onClick={resetPassword} disabled={busy || newPassword.length < 6}>{busy ? "..." : "Actualizar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="¿Borrar usuario?"
        description={`Se eliminará la cuenta de "${deleteTarget?.email}". Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        destructive
        loading={busy}
        onConfirm={async () => {
          if (!deleteTarget) return
          setBusy(true)
          try {
            await api.delete(`/zynauth/clients/${clientId}/users/${deleteTarget.id}`)
            await load()
            toast({ title: "Usuario eliminado" })
            setDeleteTarget(null)
          } catch (err) {
            toast({ title: "Error", description: formatApiError(err instanceof Error ? err.message : undefined), variant: "destructive" })
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}
