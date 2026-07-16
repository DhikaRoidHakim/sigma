import { useCallback, useEffect, useState } from "react";
import { Wrench, Plus, Pencil, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import api, { formatApiError, downloadFile } from "@/services/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PaginationBar } from "@/components/common/PaginationBar";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { useAuth } from "@/context/AuthContext";

const REPAIR_STATUS = [
  { value: "Dalam Perbaikan", label: "Dalam Perbaikan" },
  { value: "Selesai", label: "Selesai" },
];

const RepairStatusBadge = ({ status }) =>
  status === "Selesai" ? (
    <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30">Selesai</Badge>
  ) : (
    <Badge className="bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/10 border border-[#F59E0B]/30">Dalam Perbaikan</Badge>
  );

export const RepairSection = ({ assetId, onChanged }) => {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("repairs.manage");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const fetchRepairs = useCallback(() => {
    setLoading(true);
    api
      .get(`/assets/${assetId}/repairs`, { params: { page, limit: 5 } })
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [assetId, page]);

  useEffect(() => { fetchRepairs(); }, [fetchRepairs]);

  const openForm = (repair = null) => {
    setEditing(repair);
    setForm({
      tanggal_perbaikan: repair?.tanggal_perbaikan || new Date().toISOString().slice(0, 10),
      deskripsi_kerusakan: repair?.deskripsi_kerusakan || "",
      tindakan_perbaikan: repair?.tindakan_perbaikan || "",
      biaya: repair?.biaya ?? "",
      teknisi: repair?.teknisi || "",
      status: repair?.status || "Dalam Perbaikan",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      tanggal_perbaikan: form.tanggal_perbaikan,
      deskripsi_kerusakan: form.deskripsi_kerusakan,
      tindakan_perbaikan: form.tindakan_perbaikan?.trim() || null,
      biaya: form.biaya === "" ? null : Number(form.biaya),
      teknisi: form.teknisi?.trim() || null,
      status: form.status,
    };
    try {
      if (editing) {
        await api.put(`/repairs/${editing.id}`, payload);
        toast.success("Riwayat perbaikan diperbarui");
      } else {
        await api.post(`/assets/${assetId}/repairs`, payload);
        toast.success("Riwayat perbaikan dicatat");
      }
      setFormOpen(false);
      fetchRepairs();
      onChanged();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/repairs/${deleteTarget.id}`);
      toast.success("Riwayat perbaikan dihapus");
      setDeleteTarget(null);
      fetchRepairs();
      onChanged();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      await downloadFile(`/assets/${assetId}/repairs/export`, { format });
      toast.success(`Riwayat perbaikan diekspor (${format.toUpperCase()})`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="sigma-card p-6 mt-6" data-testid="repair-section">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#01567A]/5 flex items-center justify-center">
            <Wrench size={18} className="text-[#01567A]" />
          </div>
          <div>
            <h2 className="text-2xl font-medium tracking-tight text-[#1F2937]">Riwayat Perbaikan</h2>
            <p className="text-xs text-[#6B7280]">Catatan perbaikan dan pemeliharaan aset</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting || !data?.total} data-testid="repair-export-button" className="gap-1.5 border-[#E5E7EB]">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid="repair-export-csv" onClick={() => handleExport("csv")}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem data-testid="repair-export-pdf" onClick={() => handleExport("pdf")}>Export PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" data-testid="add-repair-button" onClick={() => openForm()} disabled={!canManage}
            className={`bg-[#01567A] hover:bg-[#014462] text-white gap-1.5 ${!canManage ? "hidden" : ""}`}>
            <Plus size={14} /> Tambah Perbaikan
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded-md" />)}
        </div>
      ) : !data?.items?.length ? (
        <EmptyState icon={Wrench} title="Belum ada riwayat perbaikan"
          description="Catat perbaikan aset melalui tombol Tambah Perbaikan." testId="repair-empty" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-[#E5E7EB]">
                <TableHead className="text-xs uppercase tracking-wider">Tanggal</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Kerusakan</TableHead>
                <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Tindakan</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Biaya</TableHead>
                <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Teknisi/Vendor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.id} className="hover:bg-gray-50 border-[#E5E7EB]" data-testid={`repair-row-${r.id}`}>
                  <TableCell className="font-mono text-sm text-[#6B7280] py-3.5 whitespace-nowrap">{formatDate(r.tanggal_perbaikan)}</TableCell>
                  <TableCell className="text-sm text-[#1F2937] max-w-[220px]">{r.deskripsi_kerusakan}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-[#6B7280] max-w-[220px]">{r.tindakan_perbaikan || "-"}</TableCell>
                  <TableCell className="font-mono text-sm text-[#1F2937] whitespace-nowrap">{formatCurrency(r.biaya)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-[#6B7280]">{r.teknisi || "-"}</TableCell>
                  <TableCell><RepairStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit perbaikan" data-testid={`repair-edit-${r.id}`}
                          onClick={() => openForm(r)} className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]">
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Hapus perbaikan" data-testid={`repair-delete-${r.id}`}
                          onClick={() => setDeleteTarget(r)} className="h-8 w-8 text-[#6B7280] hover:text-[#DC2626]">
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
      {data && <PaginationBar page={data.page} pages={data.pages} total={data.total} onPageChange={setPage} label="perbaikan" />}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent data-testid="repair-form-dialog" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Perbaikan" : "Catat Perbaikan"}</DialogTitle>
            <DialogDescription>Isi detail perbaikan aset di bawah ini.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tanggal_perbaikan">Tanggal Perbaikan</Label>
                <Input id="tanggal_perbaikan" type="date" required data-testid="repair-tanggal-input"
                  value={form.tanggal_perbaikan || ""} onChange={(e) => set("tanggal_perbaikan")(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <SearchableSelect options={REPAIR_STATUS} value={form.status}
                  onChange={(v) => v && set("status")(v)} placeholder="Pilih status" testId="repair-status-select" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deskripsi_kerusakan">Deskripsi Kerusakan</Label>
              <Textarea id="deskripsi_kerusakan" required minLength={3} maxLength={500} rows={2} data-testid="repair-kerusakan-input"
                value={form.deskripsi_kerusakan || ""} onChange={(e) => set("deskripsi_kerusakan")(e.target.value)}
                placeholder="Contoh: Layar bergaris dan mati total" className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tindakan_perbaikan">Tindakan Perbaikan</Label>
              <Textarea id="tindakan_perbaikan" maxLength={500} rows={2} data-testid="repair-tindakan-input"
                value={form.tindakan_perbaikan || ""} onChange={(e) => set("tindakan_perbaikan")(e.target.value)}
                placeholder="Contoh: Penggantian panel LCD" className="resize-none" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="biaya">Biaya (Rp)</Label>
                <Input id="biaya" type="number" min="0" step="any" data-testid="repair-biaya-input"
                  value={form.biaya ?? ""} onChange={(e) => set("biaya")(e.target.value)} placeholder="500000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teknisi">Teknisi / Vendor</Label>
                <Input id="teknisi" maxLength={150} data-testid="repair-teknisi-input"
                  value={form.teknisi || ""} onChange={(e) => set("teknisi")(e.target.value)} placeholder="CV Teknik Jaya" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving} data-testid="repair-form-submit" className="bg-[#01567A] hover:bg-[#014462] text-white">
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                {editing ? "Simpan Perubahan" : "Catat Perbaikan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus Riwayat Perbaikan"
        description={`Catatan perbaikan tanggal ${deleteTarget ? formatDate(deleteTarget.tanggal_perbaikan) : ""} akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
};
