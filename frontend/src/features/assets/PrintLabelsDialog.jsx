import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api, { formatApiError, downloadFile } from "@/services/api";
import { SearchableSelect } from "@/components/common/SearchableSelect";

const SCOPE_OPTIONS = [
  { value: "all", label: "Semua Aset" },
  { value: "office", label: "Per Kantor" },
  { value: "room", label: "Per Ruangan" },
];

export const PrintLabelsDialog = ({ open, onOpenChange, offices }) => {
  const [scope, setScope] = useState("all");
  const [officeId, setOfficeId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      setScope("all");
      setOfficeId(null);
      setRoomId(null);
      setRooms([]);
    }
  }, [open]);

  useEffect(() => {
    setRoomId(null);
    if (!officeId) {
      setRooms([]);
      return;
    }
    setLoadingRooms(true);
    api
      .get("/rooms", { params: { office_id: officeId } })
      .then(({ data }) => setRooms(data))
      .catch((err) => toast.error(formatApiError(err)))
      .finally(() => setLoadingRooms(false));
  }, [officeId]);

  const officeOptions = useMemo(
    () => offices.map((o) => ({ value: o.id, label: o.nama_kantor })),
    [offices]
  );
  const roomOptions = useMemo(
    () => rooms.map((r) => ({ value: r.id, label: r.nama_ruangan })),
    [rooms]
  );

  const canSubmit =
    scope === "all" ||
    (scope === "office" && officeId) ||
    (scope === "room" && officeId && roomId);

  const handleDownload = async () => {
    setDownloading(true);
    const params = {};
    if (scope === "office") params.office_id = officeId;
    if (scope === "room") {
      params.office_id = officeId;
      params.room_id = roomId;
    }
    try {
      await downloadFile("/assets/labels/export", params);
      toast.success("Label QR berhasil diunduh (PDF)");
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="print-labels-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cetak Label QR Aset</DialogTitle>
          <DialogDescription>
            Pilih cakupan aset yang akan dicetak label QR-nya (PDF, 14 label per halaman A4).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Cakupan</Label>
            <SearchableSelect
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={(v) => v && setScope(v)}
              placeholder="Pilih cakupan"
              testId="print-scope-select"
            />
          </div>

          {(scope === "office" || scope === "room") && (
            <div className="space-y-2">
              <Label>Kantor</Label>
              <SearchableSelect
                options={officeOptions}
                value={officeId}
                onChange={(v) => setOfficeId(v)}
                placeholder="Pilih kantor"
                testId="print-office-select"
              />
            </div>
          )}

          {scope === "room" && (
            <div className="space-y-2">
              <Label>Ruangan</Label>
              <SearchableSelect
                options={roomOptions}
                value={roomId}
                onChange={(v) => setRoomId(v)}
                placeholder={
                  !officeId
                    ? "Pilih kantor terlebih dahulu"
                    : loadingRooms
                    ? "Memuat ruangan..."
                    : rooms.length === 0
                    ? "Tidak ada ruangan pada kantor ini"
                    : "Pilih ruangan"
                }
                disabled={!officeId || loadingRooms || rooms.length === 0}
                testId="print-room-select"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Batal
          </Button>
          <Button
            data-testid="print-labels-submit"
            disabled={!canSubmit || downloading}
            onClick={handleDownload}
            className="bg-[#01567A] hover:bg-[#014462] text-white gap-2"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            Cetak Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
