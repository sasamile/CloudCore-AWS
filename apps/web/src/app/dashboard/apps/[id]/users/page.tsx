"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { PageHeader } from "@/components/layout/page-header"
import { PageShell } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { formatApiError } from "@/lib/format-api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TableRowsSkeleton } from "@/components/skeletons/page-skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Users, Plus, Trash2, KeyRound, ChevronLeft } from "lucide-react"

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

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
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
      <PageShell maxWidth="4xl">
        <Link
          href="/dashboard/apps"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Apps
        </Link>

        <PageHeader
          title="Pool de usuarios"
          description={`Usuarios registrados en este app client · ${clientId}`}
          actions={
            <Button className="h-9" onClick={() => { resetCreateForm(); setShowCreate(true) }}>
              <Plus className="h-4 w-4" />
              Añadir usuario
            </Button>
          }
        />

        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
            <TableRowsSkeleton rows={5} cols={1} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin usuarios todavía"
            description="Puedes crearlos aquí o dejar que se registren solos desde la Hosted UI."
            action={
              <Button className="h-9" onClick={() => { resetCreateForm(); setShowCreate(true) }}>
                <Plus className="h-4 w-4" />
                Crear el primero
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/50 divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/30">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{u.email}</span>
                    {u.emailVerified && <Badge variant="secondary" className="text-xs">verificado</Badge>}
                    {u.mfaEnabled && <Badge variant="outline" className="text-xs">MFA</Badge>}
                  </div>
                  {u.name && <p className="mt-0.5 text-xs text-muted-foreground">{u.name}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    title="Resetear contraseña"
                    onClick={() => { setResetTarget(u); setNewPassword("") }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageShell>

      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetCreateForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir usuario</DialogTitle>
            <DialogDescription>El usuario podrá iniciar sesión con estas credenciales desde la app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-9" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Nombre (opcional)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <label className="text-sm font-medium">Contraseña temporal</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-9" minLength={6} />
              <p className="mt-1 text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => { setShowCreate(false); resetCreateForm() }}>Cancelar</Button>
            <Button className="h-9" onClick={createUser} disabled={busy}>{busy ? "..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>{resetTarget?.email}</DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Nueva contraseña</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 h-9" minLength={6} autoFocus />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9" onClick={() => { setResetTarget(null); setNewPassword("") }}>Cancelar</Button>
            <Button className="h-9" onClick={resetPassword} disabled={busy || newPassword.length < 6}>{busy ? "..." : "Actualizar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
