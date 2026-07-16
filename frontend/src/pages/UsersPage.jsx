import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Pencil, Trash2, KeyRound, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SearchableSelect } from "@/components/common/SearchableSelect";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwTarget, setPwTarget] = useState(null);
  const [pwValue, setPwValue] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const fetchAll = useCallback(() => {
    api.get("/users").then(({ data }) => setUsers(data)).catch((e) => toast.error(formatApiError(e)));
    api.get("/roles").then(({ data }) => setRoles(data)).catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const openForm = (user = null) => {
    setEditing(user);
    setForm({ name: user?.name || "", email: user?.email || "", password: "", role_id: user?.role_id || null });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.role_id) {
      toast.error("Pilih role terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, { name: form.name, role_id: form.role_id });
        toast.success("User berhasil diperbarui");
      } else {
        await api.post("/users", { name: form.name, email: form.email, password: form.password, role_id: form.role_id });
        toast.success("User berhasil ditambahkan");
      }
      setFormOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await api.put(`/users/${pwTarget.id}/password`, { password: pwValue });
      toast.success(`Password ${pwTarget.name} berhasil direset`);
      setPwTarget(null);
      setPwValue("");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setPwSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setStatusSaving(true);
    try {
      await api.put(`/users/${statusTarget.id}/status`, { is_active: !statusTarget.is_active });
      toast.success(statusTarget.is_active ? "User dinonaktifkan" : "User diaktifkan");
      setStatusTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success("User berhasil dihapus");
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} data-testid="users-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]">Manajemen User</h1>
          <p className="text-[#6B7280] mt-1.5 text-sm">Kelola akun pengguna dan role aksesnya.</p>
        </div>
        <Button data-testid="add-user-button" onClick={() => openForm()} className="bg-[#01567A] hover:bg-[#014462] text-white gap-2">
          <Plus size={16} /> Tambah User
        </Button>
      </div>

      <div className="sigma-card mt-8">
        {!users ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded-md" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="Belum ada user" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#E5E7EB]">
                  <TableHead className="text-xs uppercase tracking-wider">Nama</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Role</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Dibuat</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-gray-50 border-[#E5E7EB]" data-testid={`user-row-${u.email}`}>
                    <TableCell className="font-medium text-[#1F2937] py-3.5">
                      <span className="inline-flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-[#01567A]/10 text-[#01567A] flex items-center justify-center text-xs font-semibold shrink-0">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </span>
                        {u.name}
                        {u.id === me?.id && <Badge variant="outline" className="text-[10px]">Anda</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#6B7280]">{u.email}</TableCell>
                    <TableCell>
                      <Badge className="bg-[#01567A]/5 text-[#01567A] hover:bg-[#01567A]/5 border border-[#01567A]/15">
                        {u.role_name || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30">Aktif</Badge>
                      ) : (
                        <Badge className="bg-[#DC2626]/10 text-[#B91C1C] hover:bg-[#DC2626]/10 border border-[#DC2626]/30">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#6B7280]">{formatDate(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit user" data-testid={`user-edit-${u.email}`}
                          onClick={() => openForm(u)} className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]">
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Reset password" data-testid={`user-reset-password-${u.email}`}
                          onClick={() => { setPwTarget(u); setPwValue(""); }} className="h-8 w-8 text-[#6B7280] hover:text-[#F59E0B]">
                          <KeyRound size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={u.is_active ? "Nonaktifkan user" : "Aktifkan user"}
                          data-testid={`user-toggle-status-${u.email}`} disabled={u.id === me?.id}
                          onClick={() => setStatusTarget(u)} className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]">
                          {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Hapus user" data-testid={`user-delete-${u.email}`}
                          disabled={u.id === me?.id} onClick={() => setDeleteTarget(u)}
                          className="h-8 w-8 text-[#6B7280] hover:text-[#DC2626]">
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent data-testid="user-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Tambah User"}</DialogTitle>
            <DialogDescription>
              {editing ? "Perbarui nama dan role user." : "Buat akun pengguna baru beserta role aksesnya."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nama</Label>
              <Input id="user-name" required minLength={2} data-testid="user-name-input" value={form.name || ""}
                onChange={(e) => set("name")(e.target.value)} placeholder="Budi Santoso" />
            </div>
            {!editing && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input id="user-email" type="email" required data-testid="user-email-input" value={form.email || ""}
                    onChange={(e) => set("email")(e.target.value)} placeholder="budi@sigma.co.id" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password">Password</Label>
                  <Input id="user-password" type="password" required minLength={6} data-testid="user-password-input"
                    value={form.password || ""} onChange={(e) => set("password")(e.target.value)} placeholder="Minimal 6 karakter" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <SearchableSelect options={roleOptions} value={form.role_id} onChange={set("role_id")}
                placeholder="Pilih role" testId="user-role-select" />
              {editing?.id === me?.id && (
                <p className="text-xs text-[#F59E0B]">Anda tidak dapat mengubah role akun sendiri.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving} data-testid="user-form-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
                {editing ? "Simpan Perubahan" : "Tambah User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pwTarget)} onOpenChange={(v) => !v && setPwTarget(null)}>
        <DialogContent data-testid="reset-password-dialog">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Atur password baru untuk {pwTarget?.name} ({pwTarget?.email}).</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input id="new-password" type="password" required minLength={6} data-testid="reset-password-input"
                value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="Minimal 6 karakter" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwTarget(null)} disabled={pwSaving}>Batal</Button>
              <Button type="submit" disabled={pwSaving} data-testid="reset-password-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(v) => !v && setStatusTarget(null)}
        title={statusTarget?.is_active ? "Nonaktifkan User" : "Aktifkan User"}
        description={statusTarget?.is_active
          ? `${statusTarget?.name} tidak akan bisa login setelah dinonaktifkan. Lanjutkan?`
          : `${statusTarget?.name} akan bisa login kembali. Lanjutkan?`}
        confirmLabel={statusTarget?.is_active ? "Nonaktifkan" : "Aktifkan"}
        destructive={Boolean(statusTarget?.is_active)}
        loading={statusSaving}
        onConfirm={handleToggleStatus}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus User"
        description={`Akun "${deleteTarget?.name}" (${deleteTarget?.email}) akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
