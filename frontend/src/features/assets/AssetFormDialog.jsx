import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { SearchableSelect } from "@/components/common/SearchableSelect";

export const GOLONGAN_OPTIONS = ["Golongan 1", "Golongan 2", "Golongan 3", "Golongan 4", "Golongan 5"].map((g) => ({ value: g, label: g }));
export const STATUS_OPTIONS = [
  { value: "Lunas", label: "Lunas" },
  { value: "Penyusutan", label: "Penyusutan" },
];

export const AssetFormDialog = ({ open, onOpenChange, asset, offices, onSaved }) => {
  const isEdit = Boolean(asset);
  const [form, setForm] = useState({});
  const [officeId, setOfficeId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (open) {
      setForm({
        kode_aset: asset?.kode_aset || "",
        nama_aset: asset?.nama_aset || "",
        jenis_inventaris: asset?.jenis_inventaris || "",
        golongan: asset?.golongan || null,
        tanggal_pembelian: asset?.tanggal_pembelian || "",
        nilai_pembelian: asset?.nilai_pembelian ?? "",
        status: asset?.status || null,
      });
      setOfficeId(null);
      setRoomId(null);
    }
  }, [open, asset]);

  useEffect(() => {
    if (!officeId) {
      setRooms([]);
      setRoomId(null);
      return;
    }
    setRoomsLoading(true);
    api
      .get("/rooms", { params: { office_id: officeId } })
      .then(({ data }) => setRooms(data))
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false));
    setRoomId(null);
  }, [officeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      kode_aset: form.kode_aset,
      nama_aset: form.nama_aset,
      jenis_inventaris: form.jenis_inventaris?.trim() || null,
      golongan: form.golongan || null,
      tanggal_pembelian: form.tanggal_pembelian || null,
      nilai_pembelian: form.nilai_pembelian === "" ? null : Number(form.nilai_pembelian),
      status: form.status || null,
    };
    try {
      if (isEdit) {
        await api.put(`/assets/${asset.id}`, payload);
        toast.success("Aset berhasil diperbarui");
      } else {
        await api.post("/assets", { ...payload, office_id: officeId, room_id: roomId });
        toast.success("Aset berhasil ditambahkan");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="asset-form-dialog" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui informasi aset. Lokasi diubah melalui Mutasi Asset." : "Daftarkan aset baru beserta detail inventarisnya."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kode_aset">Kode Aset</Label>
              <Input id="kode_aset" required data-testid="asset-kode-input" value={form.kode_aset || ""}
                onChange={(e) => set("kode_aset")(e.target.value)} placeholder="AST-011" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jenis_inventaris">Jenis Inventaris</Label>
              <Input id="jenis_inventaris" data-testid="asset-jenis-input" value={form.jenis_inventaris || ""}
                onChange={(e) => set("jenis_inventaris")(e.target.value)} placeholder="Elektronik" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nama_aset">Nama Aset</Label>
            <Input id="nama_aset" required data-testid="asset-nama-input" value={form.nama_aset || ""}
              onChange={(e) => set("nama_aset")(e.target.value)} placeholder="Laptop Lenovo ThinkPad" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Golongan</Label>
              <SearchableSelect options={GOLONGAN_OPTIONS} value={form.golongan} onChange={set("golongan")}
                placeholder="Pilih golongan" testId="asset-golongan-select" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <SearchableSelect options={STATUS_OPTIONS} value={form.status} onChange={set("status")}
                placeholder="Lunas / Penyusutan" testId="asset-status-select" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tanggal_pembelian">Tanggal Pembelian</Label>
              <Input id="tanggal_pembelian" type="date" data-testid="asset-tanggal-input" value={form.tanggal_pembelian || ""}
                onChange={(e) => set("tanggal_pembelian")(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nilai_pembelian">Nilai Pembelian (Rp)</Label>
              <Input id="nilai_pembelian" type="number" min="0" step="any" data-testid="asset-nilai-input"
                value={form.nilai_pembelian ?? ""} onChange={(e) => set("nilai_pembelian")(e.target.value)} placeholder="15000000" />
            </div>
          </div>
          {!isEdit && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kantor Awal (opsional)</Label>
                <SearchableSelect
                  options={offices.map((o) => ({ value: o.id, label: o.nama_kantor }))}
                  value={officeId} onChange={setOfficeId} placeholder="Pilih kantor" testId="asset-office-select" />
              </div>
              <div className="space-y-2">
                <Label>Ruangan Awal (opsional)</Label>
                <SearchableSelect
                  options={rooms.map((r) => ({ value: r.id, label: r.nama_ruangan }))}
                  value={roomId} onChange={setRoomId}
                  placeholder={officeId ? "Pilih ruangan" : "Pilih kantor dahulu"}
                  disabled={!officeId} loading={roomsLoading} testId="asset-room-select" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving} data-testid="asset-form-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
              {saving && <Loader2 size={16} className="animate-spin mr-2" />}
              {isEdit ? "Simpan Perubahan" : "Tambah Aset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
