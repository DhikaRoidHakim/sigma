import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Building2, DoorOpen, History, Search, Plus, Pencil, Trash2, MapPin, ArrowRight, Upload, Download, Wrench, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import api, { formatApiError, downloadFile } from "@/services/api";
import { locationLabel, formatDateTime } from "@/lib/format";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { PaginationBar } from "@/components/common/PaginationBar";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AssetFormDialog } from "@/features/assets/AssetFormDialog";
import { ImportDialog } from "@/features/assets/ImportDialog";
import { useAuth } from "@/context/AuthContext";

const statCards = [
  { key: "total_assets", label: "Total Aset", icon: Package },
  { key: "total_offices", label: "Kantor", icon: Building2 },
  { key: "total_rooms", label: "Ruangan", icon: DoorOpen },
  { key: "total_moves", label: "Total Mutasi", icon: History },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { hasPerm } = useAuth();
  const [stats, setStats] = useState(null);
  const [offices, setOffices] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [officeFilter, setOfficeFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);

  const handlePrintLabels = async () => {
    setPrintingLabels(true);
    try {
      await downloadFile("/assets/labels/export");
      toast.success("Label QR semua aset diunduh (PDF)");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setPrintingLabels(false);
    }
  };

  const handleExportAssets = async (format) => {
    setExporting(true);
    try {
      await downloadFile("/assets/export", { format });
      toast.success(`Data inventaris diekspor (${format.toUpperCase()})`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setExporting(false);
    }
  };

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/assets", {
        params: { search: search || undefined, office_id: officeFilter || undefined, page, limit: 10 },
      });
      setData(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search, officeFilter, page]);

  const fetchMeta = useCallback(() => {
    api.get("/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/offices").then(({ data }) => setOffices(data)).catch(() => {});
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const officeOptions = useMemo(
    () => offices.map((o) => ({ value: o.id, label: o.nama_kantor })),
    [offices]
  );

  const refreshAll = () => { fetchAssets(); fetchMeta(); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/assets/${deleteTarget.id}`);
      toast.success("Aset berhasil dihapus");
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]">Dashboard Aset</h1>
          <p className="text-[#6B7280] mt-1.5 text-sm">Pantau posisi seluruh aset dan riwayat perpindahannya.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            data-testid="print-labels-button"
            disabled={printingLabels}
            onClick={handlePrintLabels}
            className="gap-2 border-[#E5E7EB]"
          >
            {printingLabels ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
            Label QR
          </Button>
          {hasPerm("assets.import_export") && (
            <>
              <Button
                variant="outline"
                data-testid="import-assets-button"
                onClick={() => setImportOpen(true)}
                className="gap-2 border-[#E5E7EB]"
              >
                <Upload size={16} /> Import
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={exporting} data-testid="export-assets-button" className="gap-2 border-[#E5E7EB]">
                    {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem data-testid="export-assets-csv" onClick={() => handleExportAssets("csv")}>Export CSV</DropdownMenuItem>
                  <DropdownMenuItem data-testid="export-assets-xlsx" onClick={() => handleExportAssets("xlsx")}>Export Excel (.xlsx)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {hasPerm("assets.manage") && (
            <Button
              data-testid="add-asset-button"
              onClick={() => { setEditAsset(null); setFormOpen(true); }}
              className="bg-[#01567A] hover:bg-[#014462] text-white gap-2"
            >
              <Plus size={16} /> Tambah Aset
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {statCards.map(({ key, label, icon: Icon }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="sigma-card p-5"
            data-testid={`stat-${key}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wider text-[#6B7280] uppercase">{label}</p>
              <Icon size={18} strokeWidth={1.75} className="text-[#01567A]" />
            </div>
            <p className="text-3xl font-semibold text-[#1F2937] mt-3 font-mono">
              {stats ? stats[key] : "–"}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="sigma-card mt-8">
        <div className="p-5 border-b border-[#E5E7EB] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <Input
              data-testid="asset-search-input"
              placeholder="Cari kode atau nama aset..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 border-[#E5E7EB]"
            />
          </div>
          <div className="w-full sm:w-64">
            <SearchableSelect
              options={officeOptions}
              value={officeFilter}
              onChange={(v) => { setOfficeFilter(v); setPage(1); }}
              placeholder="Filter kantor"
              testId="asset-office-filter"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded-md" />
            ))}
          </div>
        ) : data?.items?.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Tidak ada aset ditemukan"
            description="Coba ubah kata kunci pencarian atau filter, atau tambahkan aset baru."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#E5E7EB]">
                  <TableHead className="text-xs uppercase tracking-wider">Kode</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Nama Aset</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Lokasi Saat Ini</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider hidden md:table-cell">Terakhir Dipindah</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-center">Mutasi</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items?.map((asset) => (
                  <TableRow
                    key={asset.id}
                    data-testid={`asset-row-${asset.kode_aset}`}
                    className="cursor-pointer hover:bg-gray-50 border-[#E5E7EB] transition-colors"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <TableCell className="font-mono text-sm text-[#01567A] font-medium py-3.5">{asset.kode_aset}</TableCell>
                    <TableCell className="font-medium text-[#1F2937]">{asset.nama_aset}</TableCell>
                    <TableCell>
                      {asset.current_office_name ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-[#1F2937]">
                          <MapPin size={14} className="text-[#92BA3C]" />
                          {locationLabel(asset.current_office_name, asset.current_room_name)}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/5">
                          Belum ditempatkan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {asset.status === "Lunas" && (
                          <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30">Lunas</Badge>
                        )}
                        {asset.status === "Penyusutan" && (
                          <Badge className="bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/10 border border-[#F59E0B]/30">Penyusutan</Badge>
                        )}
                        {asset.in_repair && (
                          <Badge className="bg-[#DC2626]/10 text-[#B91C1C] hover:bg-[#DC2626]/10 border border-[#DC2626]/30 gap-1">
                            <Wrench size={10} /> Perbaikan
                          </Badge>
                        )}
                        {!asset.status && !asset.in_repair && <span className="text-sm text-[#6B7280]">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#6B7280]">
                      {asset.last_moved_at ? formatDateTime(asset.last_moved_at) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-[#01567A]/5 text-[#01567A] text-xs font-medium font-mono">
                        {asset.total_moves}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" aria-label="Detail aset"
                          data-testid={`asset-detail-${asset.kode_aset}`}
                          onClick={() => navigate(`/assets/${asset.id}`)}
                          className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]"
                        >
                          <ArrowRight size={15} />
                        </Button>
                        {hasPerm("assets.manage") && (
                          <Button
                            variant="ghost" size="icon" aria-label="Edit aset"
                            data-testid={`asset-edit-${asset.kode_aset}`}
                            onClick={() => { setEditAsset(asset); setFormOpen(true); }}
                            className="h-8 w-8 text-[#6B7280] hover:text-[#01567A]"
                          >
                            <Pencil size={15} />
                          </Button>
                        )}
                        {hasPerm("assets.delete") && (
                          <Button
                            variant="ghost" size="icon" aria-label="Hapus aset"
                            data-testid={`asset-delete-${asset.kode_aset}`}
                            onClick={() => setDeleteTarget(asset)}
                            className="h-8 w-8 text-[#6B7280] hover:text-[#DC2626]"
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && (
          <div className="px-5 pb-5">
            <PaginationBar page={data.page} pages={data.pages} total={data.total} onPageChange={setPage} label="aset" />
          </div>
        )}
      </div>

      <AssetFormDialog open={formOpen} onOpenChange={setFormOpen} asset={editAsset} offices={offices} onSaved={refreshAll} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refreshAll} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Hapus Aset"
        description={`Aset "${deleteTarget?.nama_aset}" beserta seluruh riwayat perpindahannya akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
