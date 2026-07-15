import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, SkipForward, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";

export const ImportDialog = ({ open, onOpenChange, onImported }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState(null);

  const reset = () => { setFile(null); setReport(null); };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/assets/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setReport(data);
      if (data.imported > 0) {
        toast.success(`${data.imported} aset berhasil diimport`);
        onImported();
      } else {
        toast.info("Tidak ada aset baru yang diimport");
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent data-testid="import-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Data Inventaris</DialogTitle>
          <DialogDescription>
            Upload file CSV atau Excel (.xlsx). Kolom: Kode Aset, Nama Aset, Jenis Inventaris, Golongan, Tanggal Pembelian, Nilai Pembelian, Status, Kantor, Ruangan. Gunakan hasil Export sebagai template. Kode aset yang sudah ada akan dilewati.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          data-testid="import-dropzone"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-[#E5E7EB] hover:border-[#01567A]/40 rounded-xl p-8 flex flex-col items-center gap-2 transition-colors"
        >
          <FileSpreadsheet size={28} strokeWidth={1.5} className="text-[#01567A]" />
          {file ? (
            <p className="text-sm font-medium text-[#1F2937]">{file.name}</p>
          ) : (
            <p className="text-sm text-[#6B7280]">Klik untuk memilih file .csv / .xlsx</p>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          hidden
          data-testid="import-file-input"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); }}
        />

        {report && (
          <div className="rounded-lg border border-[#E5E7EB] divide-y divide-[#E5E7EB] text-sm" data-testid="import-report">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <CheckCircle2 size={15} className="text-[#92BA3C]" />
              <span className="text-[#1F2937]">Berhasil diimport: <strong>{report.imported}</strong></span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5">
              <SkipForward size={15} className="text-[#F59E0B]" />
              <span className="text-[#1F2937]">Dilewati (kode sudah ada): <strong>{report.skipped}</strong></span>
            </div>
            {report.errors.length > 0 && (
              <div className="px-4 py-2.5">
                <p className="flex items-center gap-2 text-[#DC2626] font-medium mb-1.5">
                  <AlertTriangle size={15} /> Error ({report.errors.length})
                </p>
                <ul className="space-y-1 max-h-32 overflow-y-auto text-xs text-[#6B7280]">
                  {report.errors.map((e, i) => (
                    <li key={i}>Baris {e.row}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Tutup</Button>
          <Button
            data-testid="import-submit-button"
            disabled={!file || uploading}
            onClick={handleUpload}
            className="bg-[#01567A] hover:bg-[#014462] text-white gap-2"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
