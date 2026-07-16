import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError, downloadFile } from "@/services/api";

export const QrLabelDialog = ({ open, onOpenChange, asset }) => {
  const [qrUrl, setQrUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !asset) return;
    let url;
    api
      .get(`/assets/${asset.id}/qrcode`, { responseType: "blob" })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        setQrUrl(url);
      })
      .catch((e) => toast.error(formatApiError(e)));
    return () => {
      if (url) URL.revokeObjectURL(url);
      setQrUrl(null);
    };
  }, [open, asset]);

  const handleDownload = async (path, label) => {
    setDownloading(true);
    try {
      await downloadFile(path);
      toast.success(label);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setDownloading(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="qr-label-dialog" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Label QR Aset</DialogTitle>
          <DialogDescription>
            Scan QR untuk membuka halaman detail aset ini.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-xl border border-[#E5E7EB] p-4 bg-white">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR code ${asset.kode_aset}`} data-testid="qr-image" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#01567A]" />
              </div>
            )}
          </div>
          <p className="font-mono text-sm font-semibold text-[#01567A]">{asset.kode_aset}</p>
          <p className="text-sm text-[#1F2937] text-center -mt-2">{asset.nama_aset}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            data-testid="qr-download-png"
            disabled={downloading}
            onClick={() => handleDownload(`/assets/${asset.id}/qrcode`, "QR code diunduh (PNG)")}
            className="gap-2 border-[#E5E7EB]"
          >
            <Download size={15} /> QR PNG
          </Button>
          <Button
            data-testid="qr-download-label"
            disabled={downloading}
            onClick={() => handleDownload(`/assets/${asset.id}/label`, "Label diunduh (PDF)")}
            className="bg-[#01567A] hover:bg-[#014462] text-white gap-2"
          >
            <Printer size={15} /> Label PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
