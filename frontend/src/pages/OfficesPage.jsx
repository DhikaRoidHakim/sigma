import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";

export default function OfficesPage() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("offices.manage");
  const [offices, setOffices] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOffices = useCallback(() => {
    api.get("/offices").then(({ data }) => setOffices(data)).catch((e) => toast.error(formatApiError(e)));
  }, []);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  const openForm = (office = null) => {
    setEditing(office);
    setName(office?.nama_kantor || "");
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/offices/${editing.id}`, { nama_kantor: name });
        toast.success("Kantor berhasil diperbarui");
      } else {
        await api.post("/offices", { nama_kantor: name });
        toast.success("Kantor berhasil ditambahkan");
      }
      setFormOpen(false);
      fetchOffices();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/offices/${deleteTarget.id}`);
      toast.success("Kantor berhasil dihapus. Riwayat perpindahan aset tetap tersimpan.");
      setDeleteTarget(null);
      fetchOffices();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} data-testid="offices-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]">Kantor</h1>
          <p className="text-[#6B7280] mt-1.5 text-sm">Kelola daftar kantor tempat aset ditempatkan.</p>
        </div>
        {canManage && (
          <Button data-testid="add-office-button" onClick={() => openForm()} className="bg-[#01567A] hover:bg-[#014462] text-white gap-2">
            <Plus size={16} /> Tambah Kantor
          </Button>
        )}
      </div>

      <div className="sigma-card mt-8">
        {!offices ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded-md" />)}
          </div>
        ) : offices.length === 0 ? (
          <EmptyState icon={Building2} title="Belum ada kantor" description="Tambahkan kantor pertama untuk mulai menempatkan aset." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#E5E7EB]">
                  <TableHead className="text-xs uppercase tracking-wider">Nama Kantor</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-center">Ruangan</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-center">Aset</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Dibuat</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offices.map((office) => (
                  <TableRow key={office.id} className="hover:bg-gray-50 border-[#E5E7EB]" data-testid={`office-row-${office.id}`}>
                    <TableCell className="font-medium text-[#1F2937] py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <Building2 size={15} className="text-[#01567A]" /> {office.nama_kantor}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-[#6B7280]">{office.jumlah_ruangan}</TableCell>
                    <TableCell className="text-center font-mono text-sm text-[#6B7280]">{office.jumlah_aset}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#6B7280]">{formatDate(office.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit kantor" data-testid={`office-edit-${office.id}`}
                            onClick={() => openForm(office)} className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]">
                            <Pencil size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Hapus kantor" data-testid={`office-delete-${office.id}`}
                            onClick={() => setDeleteTarget(office)} className="h-8 w-8 text-[#6B7280] hover:text-[#DC2626]">
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent data-testid="office-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Kantor" : "Tambah Kantor"}</DialogTitle>
            <DialogDescription>Masukkan nama kantor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama_kantor">Nama Kantor</Label>
              <Input id="nama_kantor" required data-testid="office-name-input" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Kantor Cabang Medan" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving} data-testid="office-form-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
                {editing ? "Simpan Perubahan" : "Tambah Kantor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus Kantor"
        description={`Kantor "${deleteTarget?.nama_kantor}" beserta ruangannya akan dihapus. Aset di kantor ini menjadi "Belum ditempatkan", namun riwayat perpindahan aset TETAP tersimpan. Lanjutkan?`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
