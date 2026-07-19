"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Users, UserPlus, Shield, Mail, Phone, MapPin, Edit, Trash2, Ban, CheckCircle2,
  Crown, Wrench, Eye, User, Loader2, ShieldAlert,
} from "lucide-react"

interface UserInterface {
  id: string
  name: string
  email?: string | null
  role: "admin" | "manager" | "operator" | "viewer"
  status: string
  lastLogin?: string
  phone?: string
  location?: string
  permissions?: string[]
  createdAt?: string
  authMethod?: string
}

const BLOCKED = new Set(["blocked", "inactive", "suspended"])
const isBlocked = (s?: string) => BLOCKED.has(String(s || "").toLowerCase())

const getDefaultPermissions = (role: string): string[] => {
  switch (role) {
    case "admin": return ["all"]
    case "manager": return ["dashboard", "map", "spraying", "analytics", "recommendations"]
    case "operator": return ["dashboard", "map", "spraying"]
    case "viewer": return ["dashboard", "analytics"]
    default: return ["dashboard"]
  }
}

const roleColor = (role: string) =>
  role === "admin" ? "destructive" : role === "manager" ? "default" : role === "operator" ? "secondary" : "outline"

const roleIcon = (role: string) => {
  switch (role) {
    case "admin": return <Crown className="h-4 w-4" />
    case "manager": return <Shield className="h-4 w-4" />
    case "operator": return <Wrench className="h-4 w-4" />
    case "viewer": return <Eye className="h-4 w-4" />
    default: return <User className="h-4 w-4" />
  }
}

export default function UserManagement() {
  const router = useRouter()
  const [users, setUsers] = useState<UserInterface[]>([])
  const [currentUser, setCurrentUser] = useState<UserInterface | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserInterface | null>(null)
  const [newUser, setNewUser] = useState({
    name: "", email: "", password: "", role: "operator" as const, phone: "", location: "",
  })

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/auth/me")
        const meData = await meRes.json().catch(() => ({}))
        if (!meRes.ok || !meData?.success) {
          router.replace("/login")
          return
        }
        setCurrentUser(meData.user)
        if (meData.user?.role !== "admin") {
          setDenied(true)
          setLoading(false)
          return
        }
        const usersRes = await fetch("/api/users")
        if (usersRes.status === 403) {
          setDenied(true)
        } else {
          setUsers(await usersRes.json())
        }
      } catch {
        toast.error("Failed to load user data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = u.name.toLowerCase().includes(q) || String(u.email || "").toLowerCase().includes(q) || String(u.phone || "").includes(q)
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "blocked" ? isBlocked(u.status) : !isBlocked(u.status))
    return matchesSearch && matchesRole && matchesStatus
  })

  const addUser = async () => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUser,
          status: "active",
          lastLogin: "Never",
          permissions: getDefaultPermissions(newUser.role),
        }),
      })
      const created = await res.json()
      if (res.ok && created.id) {
        setUsers([...users, created])
        setNewUser({ name: "", email: "", password: "", role: "operator", phone: "", location: "" })
        setIsAddOpen(false)
        toast.success("User created")
      } else {
        toast.error(created.message || "Failed to create user")
      }
    } catch {
      toast.error("An error occurred")
    }
  }

  const updateUser = async (payload: UserInterface, successMsg: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const updated = await res.json()
      if (res.ok && updated.id) {
        setUsers(users.map((u) => (u.id === payload.id ? updated : u)))
        toast.success(successMsg)
        return true
      }
      toast.error(updated.message || "Update failed")
      return false
    } catch {
      toast.error("An error occurred")
      return false
    }
  }

  const saveEdit = async () => {
    if (!editingUser) return
    const ok = await updateUser({ ...editingUser, permissions: getDefaultPermissions(editingUser.role) }, "User updated")
    if (ok) {
      setIsEditOpen(false)
      setEditingUser(null)
    }
  }

  const toggleBlock = async (user: UserInterface) => {
    const willBlock = !isBlocked(user.status)
    if (willBlock && !confirm(`Block ${user.name}? They will be signed out and unable to log in until unblocked.`)) return
    await updateUser({ ...user, status: willBlock ? "blocked" : "active" }, willBlock ? "User blocked" : "User unblocked")
  }

  const removeUser = async (user: UserInterface) => {
    if (!confirm(`Permanently remove ${user.name}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/users?id=${user.id}`, { method: "DELETE" })
      const result = await res.json()
      if (res.ok && result.success) {
        setUsers(users.filter((u) => u.id !== user.id))
        toast.success("User removed")
      } else {
        toast.error(result.message || "Failed to remove user")
      }
    } catch {
      toast.error("An error occurred")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#3a7d44]" />
        <p className="animate-pulse text-muted-foreground">Loading users…</p>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <ShieldAlert className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Administrator access required</h2>
          <p className="mt-1 max-w-sm text-muted-foreground">
            User management is restricted to administrators. Contact an admin if you need access.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
      </div>
    )
  }

  const activeCount = users.filter((u) => !isBlocked(u.status)).length
  const blockedCount = users.filter((u) => isBlocked(u.status)).length
  const adminCount = users.filter((u) => u.role === "admin").length

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-[#1a2e1d]">
            <Users className="h-7 w-7 text-green-600" /> User Management
          </h1>
          <p className="text-muted-foreground">Manage accounts, roles, and access across Bhoomitra.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-green-600 hover:bg-green-700"><UserPlus className="h-4 w-4" /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create an account with a role and a temporary password.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Enter full name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input type="text" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Set a starting password" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v: any) => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Location (optional)</Label>
                  <Input value={newUser.location} onChange={(e) => setNewUser({ ...newUser, location: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={addUser} disabled={!newUser.name || !newUser.email || !newUser.password}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-slate-700" },
          { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-green-600" },
          { label: "Blocked", value: blockedCount, icon: Ban, color: "text-red-600" },
          { label: "Admins", value: adminCount, icon: Crown, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        {/* Users */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <Input placeholder="Search by name, email, or phone…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="md:max-w-xs" />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="md:max-w-[180px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:max-w-[180px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Accounts</CardTitle>
              <CardDescription>Block access or remove accounts. You can’t block or remove your own admin account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">No users match your filters.</div>
                ) : (
                  filteredUsers.map((user) => {
                    const blocked = isBlocked(user.status)
                    const isSelf = user.id === currentUser?.id
                    return (
                      <div key={user.id} className={`flex flex-col gap-4 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${blocked ? "border-red-100 bg-red-50/40" : ""}`}>
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback className={blocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}>
                              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold">{user.name}</h4>
                              {isSelf && <Badge variant="outline" className="text-[10px]">You</Badge>}
                              <Badge variant={roleColor(user.role) as any} className="flex items-center gap-1">
                                {roleIcon(user.role)} {user.role}
                              </Badge>
                              <span className={`text-xs font-medium ${blocked ? "text-red-600" : "text-green-600"}`}>
                                ● {blocked ? "blocked" : "active"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              {user.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>}
                              {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                              {user.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{user.location}</span>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                              Last login: {user.lastLogin || "Never"} • Joined: {user.createdAt || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button variant="outline" size="sm" title="Edit"
                            onClick={() => { setEditingUser(user); setIsEditOpen(true) }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!isSelf && (
                            <>
                              <Button variant="outline" size="sm"
                                className={blocked ? "text-green-600 hover:border-green-500" : "text-amber-600 hover:border-amber-500"}
                                title={blocked ? "Unblock" : "Block access"}
                                onClick={() => toggleBlock(user)}>
                                {blocked ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-600 hover:border-red-600" title="Remove"
                                onClick={() => removeUser(user)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update details and role for this account.</DialogDescription>
              </DialogHeader>
              {editingUser && (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={editingUser.role} onValueChange={(v: any) => setEditingUser({ ...editingUser, role: v })}
                      disabled={editingUser.id === currentUser?.id}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="operator">Operator</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    {editingUser.id === currentUser?.id && (
                      <p className="text-xs text-muted-foreground">You can’t change your own role.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editingUser.phone || ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={editingUser.location || ""} onChange={(e) => setEditingUser({ ...editingUser, location: e.target.value })} />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button onClick={saveEdit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Roles reference */}
        <TabsContent value="roles" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { icon: Crown, color: "text-red-600", name: "Administrator", desc: "Full access — manage users, block/remove accounts, all features.", perms: ["All permissions"] },
              { icon: Shield, color: "text-blue-600", name: "Manager", desc: "Operational oversight, analytics, spraying control.", perms: ["Dashboard", "Analytics", "Spraying", "Recommendations"] },
              { icon: Wrench, color: "text-green-600", name: "Operator", desc: "Field operations, spraying, map access.", perms: ["Dashboard", "Map", "Spraying"] },
              { icon: Eye, color: "text-slate-600", name: "Viewer", desc: "Read-only access to dashboard and reports.", perms: ["Dashboard", "Analytics"] },
            ].map((r) => (
              <Card key={r.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><r.icon className={`h-5 w-5 ${r.color}`} /> {r.name}</CardTitle>
                  <CardDescription>{r.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {r.perms.map((p) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
