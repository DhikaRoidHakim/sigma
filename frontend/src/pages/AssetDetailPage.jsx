import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Building2, MapPin, Calendar, Clock, History, ChevronRight, FilterX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import api, { formatApiError } from "@/services/api";
import { formatDate, formatDateTime, locationLabel } from "@/lib/format";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { PaginationBar } from "@/components/common/PaginationBar";
import { EmptyState } from "@/components/common/EmptyState";
import { MoveAssetForm } from "@/features/assets/MoveAssetForm";
import { HistoryTimeline } from "@/features/assets/HistoryTimeline";

const InfoRow = ({ icon: Icon, label, value, mono = false }) => (
  <div className="flex items-start gap-3 py-2.5">
    <Icon size={16} strokeWidth={1.75} className="text-[#6B7280] mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className={`text-sm font-medium text-[#1F2937] mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  </div>
);

export default function AssetDetailPage() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [offices, setOffices] = useState([]);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [officeFilter, setOfficeFilter] = useState(null);

  const hasFilters = Boolean(dateFrom || dateTo || officeFilter);

  const fetchAsset = useCallback(() => {
    api
      .get(`/assets/${id}`)
      .then(({ data }) => setAsset(data))
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
        else toast.error(formatApiError(err));
      });
  }, [id]);

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    api
      .get(`/assets/${id}/history`, {
        params: {
          page,
          limit: 5,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          office_id: officeFilter || undefined,
        },
      })
      .then(({ data }) => setHistory(data))
      .catch((err) => toast.error(formatApiError(err)))
      .finally(() => setHistoryLoading(false));
  }, [id, page, dateFrom, dateTo, officeFilter]);

  useEffect(() => {
    fetchAsset();
    api.get("/offices").then(({ data }) => setOffices(data)).catch(() => {});
  }, [fetchAsset]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleMoved = () => { fetchAsset(); setPage(1); fetchHistory(); };
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setOfficeFilter(null); setPage(1); };

  if (notFound) {
    return (
      <EmptyState
        icon={Package}
        title="Aset tidak ditemukan"
        description="Aset yang Anda cari tidak ada atau telah dihapus."
        action={
          <Button asChild variant="outline"><Link to="/">Kembali ke Dashboard</Link></Button>
        }
      />
    );
  }

  if (!asset) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-64 bg-gray-200" />
        <Skeleton className="h-10 w-96 bg-gray-200" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 bg-gray-200 rounded-xl" />
          <Skeleton className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} data-testid="asset-detail-page">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[#6B7280]">
        <Link to="/" className="hover:text-[#01567A] transition-colors" data-testid="breadcrumb-dashboard">
          Dashboard Aset
        </Link>
        <ChevronRight size={14} />
        <span className="text-[#1F2937] font-medium">{asset.kode_aset}</span>
      </nav>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]" data-testid="asset-title">
          {asset.nama_aset}
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-[#01567A] bg-[#01567A]/5 px-2.5 py-1 rounded-md border border-[#01567A]/10">
            {asset.kode_aset}
          </span>
          {asset.current_office_name ? (
            <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30 gap-1">
              <MapPin size={11} /> Ditempatkan
            </Badge>
          ) : (
            <Badge className="bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/10 border border-[#F59E0B]/30">
              Belum ditempatkan
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 mt-8 items-start">
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="sigma-card p-6" data-testid="asset-info-card">
            <h3 className="text-lg font-medium text-[#1F2937] mb-3">Informasi Asset</h3>
            <div className="divide-y divide-[#E5E7EB]">
              <InfoRow icon={Package} label="Nama Asset" value={asset.nama_aset} />
              <InfoRow icon={History} label="Kode Asset" value={asset.kode_aset} mono />
              <InfoRow icon={Calendar} label="Tanggal Dibuat" value={formatDate(asset.created_at)} />
              <InfoRow
                icon={Clock}
                label="Terakhir Dipindahkan"
                value={asset.last_moved_at ? formatDateTime(asset.last_moved_at) : "Belum pernah dipindahkan"}
              />
            </div>
          </div>

          <div className="sigma-card p-6" data-testid="current-location-card">
            <h3 className="text-lg font-medium text-[#1F2937] mb-3">Lokasi Saat Ini</h3>
            <div className="divide-y divide-[#E5E7EB]">
              <InfoRow icon={Building2} label="Kantor" value={asset.current_office_name || "Belum ditempatkan"} />
              <InfoRow icon={MapPin} label="Ruangan" value={asset.current_room_name || "-"} />
              <InfoRow icon={History} label="Total Mutasi" value={`${asset.total_moves} perpindahan`} mono />
            </div>
          </div>

          <MoveAssetForm asset={asset} offices={offices} onMoved={handleMoved} />
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          <div className="sigma-card p-6" data-testid="history-section">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#01567A]/5 flex items-center justify-center">
                    <History size={18} className="text-[#01567A]" />
                  </div>
                  <h2 className="text-2xl font-medium tracking-tight text-[#1F2937]">Riwayat Perpindahan</h2>
                </div>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-history-filters" className="text-[#6B7280] gap-1.5">
                    <FilterX size={14} /> Reset filter
                  </Button>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="date-from" className="text-xs text-[#6B7280] block mb-1.5">Dari tanggal</label>
                  <Input
                    id="date-from" type="date" data-testid="history-date-from"
                    value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="border-[#E5E7EB] text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="date-to" className="text-xs text-[#6B7280] block mb-1.5">Sampai tanggal</label>
                  <Input
                    id="date-to" type="date" data-testid="history-date-to"
                    value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="border-[#E5E7EB] text-sm"
                  />
                </div>
                <div>
                  <span className="text-xs text-[#6B7280] block mb-1.5">Kantor</span>
                  <SearchableSelect
                    options={offices.map((o) => ({ value: o.id, label: o.nama_kantor }))}
                    value={officeFilter}
                    onChange={(v) => { setOfficeFilter(v); setPage(1); }}
                    placeholder="Semua kantor"
                    testId="history-office-filter"
                  />
                </div>
              </div>
            </div>

            <HistoryTimeline
              asset={asset}
              logs={history?.items || []}
              loading={historyLoading}
              isFirstPageUnfiltered={page === 1 && !hasFilters}
            />
            {history && (
              <PaginationBar page={history.page} pages={history.pages} total={history.total} onPageChange={setPage} label="riwayat" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
