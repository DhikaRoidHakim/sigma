import { useEffect, useState } from "react";
import { Loader2, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { locationLabel } from "@/lib/format";

export const MoveAssetForm = ({ asset, offices, onMoved }) => {
  const [officeId, setOfficeId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!officeId) {
      setRooms([]);
      setRoomId(null);
      return;
    }
    setRoomsLoading(true);
    setRoomId(null);
    api
      .get("/rooms", { params: { office_id: officeId } })
      .then(({ data }) => setRooms(data))
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false));
  }, [officeId]);

  const selectedOffice = offices.find((o) => o.id === officeId);
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const canSubmit = officeId && roomId && !submitting;

  const handleMove = async () => {
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/move`, {
        office_id: officeId,
        room_id: roomId,
        notes: notes.trim() || null,
      });
      toast.success("Aset berhasil dipindahkan", {
        description: `${asset.nama_aset} kini berada di ${locationLabel(selectedOffice?.nama_kantor, selectedRoom?.nama_ruangan)}`,
      });
      setConfirmOpen(false);
      setOfficeId(null);
      setRoomId(null);
      setNotes("");
      onMoved();
    } catch (err) {
      setConfirmOpen(false);
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sigma-card p-6" data-testid="move-asset-form">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-lg bg-[#01567A]/5 flex items-center justify-center">
          <MoveRight size={18} className="text-[#01567A]" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-[#1F2937]">Mutasi Asset</h3>
          <p className="text-xs text-[#6B7280]">Pindahkan aset ke kantor dan ruangan lain</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Kantor Tujuan</Label>
          <SearchableSelect
            options={offices.map((o) => ({ value: o.id, label: o.nama_kantor }))}
            value={officeId}
            onChange={setOfficeId}
            placeholder="Pilih kantor tujuan"
            searchPlaceholder="Cari kantor..."
            testId="move-office-select"
          />
        </div>
        <div className="space-y-2">
          <Label>Ruangan Tujuan</Label>
          <SearchableSelect
            options={rooms.map((r) => ({ value: r.id, label: r.nama_ruangan }))}
            value={roomId}
            onChange={setRoomId}
            placeholder={officeId ? "Pilih ruangan tujuan" : "Pilih kantor terlebih dahulu"}
            searchPlaceholder="Cari ruangan..."
            disabled={!officeId}
            loading={roomsLoading}
            testId="move-room-select"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="move-notes">Catatan</Label>
            <span className={`text-xs ${notes.length > 500 ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
              {notes.length}/500
            </span>
          </div>
          <Textarea
            id="move-notes"
            data-testid="move-notes-textarea"
            placeholder="Contoh: Mutasi ke Ruang IT untuk kebutuhan proyek"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            className="border-[#E5E7EB] resize-none"
          />
        </div>
        <Button
          data-testid="move-asset-submit-button"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
          className="w-full bg-[#01567A] hover:bg-[#014462] text-white gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <MoveRight size={16} />}
          Pindahkan Asset
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Konfirmasi Mutasi Asset"
        description={`Pindahkan "${asset.nama_aset}" dari ${locationLabel(asset.current_office_name, asset.current_room_name)} ke ${locationLabel(selectedOffice?.nama_kantor, selectedRoom?.nama_ruangan)}?`}
        confirmLabel="Ya, Pindahkan"
        loading={submitting}
        onConfirm={handleMove}
      />
    </div>
  );
};
