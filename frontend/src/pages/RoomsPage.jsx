import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DoorOpen, Plus, Pencil, Trash2, Building2, UserCog } from "lucide-react";
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
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { useAuth } from "@/context/AuthContext";

export default function RoomsPage() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("rooms.manage");
  const [rooms, setRooms] = useState(null);
  const [offices, setOffices] = useState([]);
  const [officeFilter, setOfficeFilter] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [pic, setPic] = useState("");
  const [formOfficeId, setFormOfficeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRooms = useCallback(() => {
    api
      .get("/rooms", { params: { office_id: officeFilter || undefined } })
      .then(({ data }) => setRooms(data))
      .catch((e) => toast.error(formatApiError(e)));
  }, [officeFilter]);

  useEffect(() => {
    api.get("/offices").then(({ data }) => setOffices(data)).catch(() => {});
  }, []);
  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openForm = (room = null) => {
    setEditing(room);
    setName(room?.nama_ruangan || "");
    setPic(room?.penanggung_jawab || "");
    setFormOfficeId(room?.office_id || null);
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formOfficeId) {
      toast.error("Pilih kantor terlebih dahulu");
      return;
    }
    setSaving(true);
    const payload = {
      nama_ruangan: name,
      office_id: formOfficeId,
      penanggung_jawab: pic.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/rooms/${editing.id}`, payload);
        toast.success("Ruangan berhasil diperbarui");
      } else {
        await api.post("/rooms", payload);
        toast.success("Ruangan berhasil ditambahkan");
      }
      setFormOpen(false);
      fetchRooms();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/rooms/${deleteTarget.id}`);
      toast.success("Ruangan berhasil dihapus. Riwayat perpindahan aset tetap tersimpan.");
      setDeleteTarget(null);
      fetchRooms();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} data-testid="rooms-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]">Ruangan</h1>
          <p className="text-[#6B7280] mt-1.5 text-sm">Kelola ruangan pada setiap kantor.</p>
        </div>
        {canManage && (
          <Button data-testid="add-room-button" onClick={() => openForm()} className="bg-[#01567A] hover:bg-[#014462] text-white gap-2">
            <Plus size={16} /> Tambah Ruangan
          </Button>
        )}
      </div>

      <div className="sigma-card mt-8">
        <div className="p-5 border-b border-[#E5E7EB]">
          <div className="w-full sm:w-72">
            <SearchableSelect
              options={offices.map((o) => ({ value: o.id, label: o.nama_kantor }))}
              value={officeFilter}
              onChange={setOfficeFilter}
              placeholder="Filter kantor"
              testId="room-office-filter"
            />
          </div>
        </div>
        {!rooms ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded-md" />)}
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState icon={DoorOpen} title="Belum ada ruangan" description="Tambahkan ruangan untuk kantor Anda." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#E5E7EB]">
                  <TableHead className="text-xs uppercase tracking-wider">Nama Ruangan</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Kantor</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Penanggung Jawab</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-center">Aset</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Dibuat</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id} className="hover:bg-gray-50 border-[#E5E7EB]" data-testid={`room-row-${room.id}`}>
                    <TableCell className="font-medium text-[#1F2937] py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <DoorOpen size={15} className="text-[#01567A]" /> {room.nama_ruangan}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#6B7280]">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 size={13} /> {room.nama_kantor || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#1F2937]">
                      {room.penanggung_jawab ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserCog size={13} className="text-[#01567A]" />
                          {room.penanggung_jawab}
                        </span>
                      ) : (
                        <span className="text-[#6B7280]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-[#6B7280]">{room.jumlah_aset}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#6B7280]">{formatDate(room.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit ruangan" data-testid={`room-edit-${room.id}`}
                            onClick={() => openForm(room)} className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]">
                            <Pencil size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Hapus ruangan" data-testid={`room-delete-${room.id}`}
                            onClick={() => setDeleteTarget(room)} className="h-8 w-8 text-[#6B7280] hover:text-[#DC2626]">
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
        <DialogContent data-testid="room-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Ruangan" : "Tambah Ruangan"}</DialogTitle>
            <DialogDescription>Ruangan harus terhubung dengan sebuah kantor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Kantor</Label>
              <SearchableSelect
                options={offices.map((o) => ({ value: o.id, label: o.nama_kantor }))}
                value={formOfficeId}
                onChange={setFormOfficeId}
                placeholder="Pilih kantor"
                testId="room-form-office-select"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama_ruangan">Nama Ruangan</Label>
              <Input id="nama_ruangan" required data-testid="room-name-input" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Ruang Meeting Lantai 2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="penanggung_jawab">Penanggung Jawab</Label>
              <Input
                id="penanggung_jawab"
                data-testid="room-pic-input"
                value={pic}
                maxLength={100}
                onChange={(e) => setPic(e.target.value)}
                placeholder="Contoh: Budi Santoso"
              />
              <p className="text-xs text-[#6B7280]">Opsional. Ditampilkan di detail aset & halaman scan QR.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving} data-testid="room-form-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
                {editing ? "Simpan Perubahan" : "Tambah Ruangan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus Ruangan"
        description={`Ruangan "${deleteTarget?.nama_ruangan}" akan dihapus. Aset di ruangan ini kehilangan penempatan ruangan, namun riwayat perpindahan TETAP tersimpan. Lanjutkan?`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
