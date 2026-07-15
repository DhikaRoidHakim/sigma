import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { SearchableSelect } from "@/components/common/SearchableSelect";

export const AssetFormDialog = ({ open, onOpenChange, asset, offices, onSaved }) => {
  const isEdit = Boolean(asset);
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [officeId, setOfficeId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKode(asset?.kode_aset || "");
      setNama(asset?.nama_aset || "");
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
    try {
      if (isEdit) {
        await api.put(`/assets/${asset.id}`, { kode_aset: kode, nama_aset: nama });
        toast.success("Aset berhasil diperbarui");
      } else {
        await api.post("/assets", { kode_aset: kode, nama_aset: nama, office_id: officeId, room_id: roomId });
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
      <DialogContent data-testid="asset-form-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui informasi aset. Lokasi diubah melalui Mutasi Asset." : "Daftarkan aset baru beserta lokasi awalnya."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode_aset">Kode Aset</Label>
            <Input id="kode_aset" required data-testid="asset-kode-input" value={kode} onChange={(e) => setKode(e.target.value)} placeholder="AST-011" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nama_aset">Nama Aset</Label>
            <Input id="nama_aset" required data-testid="asset-nama-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Laptop Lenovo ThinkPad" />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label>Kantor Awal (opsional)</Label>
                <SearchableSelect
                  options={offices.map((o) => ({ value: o.id, label: o.nama_kantor }))}
                  value={officeId}
                  onChange={setOfficeId}
                  placeholder="Pilih kantor"
                  testId="asset-office-select"
                />
              </div>
              <div className="space-y-2">
                <Label>Ruangan Awal (opsional)</Label>
                <SearchableSelect
                  options={rooms.map((r) => ({ value: r.id, label: r.nama_ruangan }))}
                  value={roomId}
                  onChange={setRoomId}
                  placeholder={officeId ? "Pilih ruangan" : "Pilih kantor terlebih dahulu"}
                  disabled={!officeId}
                  loading={roomsLoading}
                  testId="asset-room-select"
                />
              </div>
            </>
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
