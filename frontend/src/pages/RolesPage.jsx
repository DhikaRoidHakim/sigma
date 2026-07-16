import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export default function RolesPage() {
  const [roles, setRoles] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(() => {
    api.get("/roles").then(({ data }) => setRoles(data)).catch((e) => toast.error(formatApiError(e)));
    api.get("/permissions").then(({ data }) => setPermissions(data)).catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const groupedPerms = useMemo(() => {
    const groups = {};
    permissions.forEach((p) => {
      (groups[p.group] = groups[p.group] || []).push(p);
    });
    return groups;
  }, [permissions]);

  const openForm = (role = null) => {
    setEditing(role);
    setName(role?.name || "");
    setDescription(role?.description || "");
    setSelectedPerms(role?.permissions || []);
    setFormOpen(true);
  };

  const togglePerm = (key) =>
    setSelectedPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPerms.length === 0) {
      toast.error("Pilih minimal satu izin");
      return;
    }
    setSaving(true);
    try {
      const payload = { name, description: description.trim() || null, permissions: selectedPerms };
      if (editing) {
        await api.put(`/roles/${editing.id}`, payload);
        toast.success("Role berhasil diperbarui");
      } else {
        await api.post("/roles", payload);
        toast.success("Role berhasil ditambahkan");
      }
      setFormOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      toast.success("Role berhasil dihapus");
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const permLabel = (key) => permissions.find((p) => p.key === key)?.label || key;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} data-testid="roles-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]">Role & Izin</h1>
          <p className="text-[#6B7280] mt-1.5 text-sm">Kelola role dan hak akses pengguna sistem.</p>
        </div>
        <Button data-testid="add-role-button" onClick={() => openForm()} className="bg-[#01567A] hover:bg-[#014462] text-white gap-2">
          <Plus size={16} /> Tambah Role
        </Button>
      </div>

      <div className="sigma-card mt-8">
        {!roles ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded-md" />)}
          </div>
        ) : roles.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Belum ada role" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#E5E7EB]">
                  <TableHead className="text-xs uppercase tracking-wider">Role</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Deskripsi</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Izin</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-center">User</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-gray-50 border-[#E5E7EB]" data-testid={`role-row-${role.name}`}>
                    <TableCell className="font-medium text-[#1F2937] py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck size={15} className="text-[#01567A]" />
                        {role.name}
                        {role.is_system && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-[#6B7280]">
                            <Lock size={9} /> Sistem
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#6B7280] max-w-[280px]">{role.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[320px]">
                        {role.permissions.slice(0, 3).map((p) => (
                          <Badge key={p} className="bg-[#01567A]/5 text-[#01567A] hover:bg-[#01567A]/5 border border-[#01567A]/15 text-[10px]">
                            {permLabel(p)}
                          </Badge>
                        ))}
                        {role.permissions.length > 3 && (
                          <Badge variant="outline" className="text-[10px] text-[#6B7280]">+{role.permissions.length - 3} lainnya</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-[#6B7280]">{role.jumlah_user}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit role" data-testid={`role-edit-${role.name}`}
                          disabled={role.is_system} onClick={() => openForm(role)}
                          className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]">
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Hapus role" data-testid={`role-delete-${role.name}`}
                          disabled={role.is_system} onClick={() => setDeleteTarget(role)}
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
        <DialogContent data-testid="role-form-dialog" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Role" : "Tambah Role"}</DialogTitle>
            <DialogDescription>Tentukan nama role dan izin yang dimilikinya.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nama Role</Label>
              <Input id="role-name" required minLength={2} data-testid="role-name-input" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Supervisor Gudang" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Deskripsi</Label>
              <Input id="role-description" maxLength={200} data-testid="role-description-input" value={description}
                onChange={(e) => setDescription(e.target.value)} placeholder="Mengelola aset di gudang" />
            </div>
            <div className="space-y-3">
              <Label>Izin Akses</Label>
              {Object.entries(groupedPerms).map(([group, perms]) => (
                <div key={group} className="rounded-lg border border-[#E5E7EB] p-3">
                  <p className="text-xs font-medium tracking-wider text-[#6B7280] uppercase mb-2.5">{group}</p>
                  <div className="space-y-2">
                    {perms.map((p) => (
                      <label key={p.key} className="flex items-center gap-2.5 cursor-pointer">
                        <Checkbox
                          checked={selectedPerms.includes(p.key)}
                          onCheckedChange={() => togglePerm(p.key)}
                          data-testid={`perm-checkbox-${p.key}`}
                        />
                        <span className="text-sm text-[#1F2937]">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving} data-testid="role-form-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
                {editing ? "Simpan Perubahan" : "Tambah Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus Role"
        description={`Role "${deleteTarget?.name}" akan dihapus permanen. Role hanya bisa dihapus jika tidak ada user yang menggunakannya. Lanjutkan?`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
