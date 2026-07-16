import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Package, Building2, MapPin, Calendar, Clock, History, Tag, Layers,
  Wrench, ArrowRight, User, ShieldCheck, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDate, formatDateTime, locationLabel } from "@/lib/format";

const publicApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api/public`,
});

const LocationChip = ({ officeName, roomName, muted = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
      muted
        ? "bg-gray-50 text-[#6B7280] border-[#E5E7EB]"
        : "bg-[#01567A]/5 text-[#01567A] border-[#01567A]/15"
    }`}
  >
    <Building2 size={12} strokeWidth={2} />
    {officeName || "Tanpa lokasi"}
    {roomName && (
      <>
        <span className="opacity-40">/</span>
        <MapPin size={12} strokeWidth={2} />
        {roomName}
      </>
    )}
  </span>
);

const InfoItem = ({ icon: Icon, label, value, mono = false }) => (
  <div className="flex items-start gap-3 py-2.5">
    <Icon size={16} strokeWidth={1.75} className="text-[#6B7280] mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className={`text-sm font-medium text-[#1F2937] mt-0.5 break-words ${mono ? "font-mono" : ""}`}>
        {value ?? "-"}
      </p>
    </div>
  </div>
);

export default function PublicAssetPage() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      publicApi.get(`/assets/${id}`),
      publicApi.get(`/assets/${id}/history`),
      publicApi.get(`/assets/${id}/repairs`),
    ])
      .then(([a, h, r]) => {
        if (cancelled) return;
        setAsset(a.data);
        setHistory(h.data.items || []);
        setRepairs(r.data.items || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.status === 404 ? "Aset tidak ditemukan" : "Gagal memuat data aset");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SIGMA" className="w-9 h-9 rounded-md" />
            <div>
              <p className="text-base font-semibold text-[#01567A] tracking-tight leading-tight">SIGMA</p>
              <p className="text-[11px] text-[#6B7280] leading-tight">Sistem Informasi Manajemen Aset</p>
            </div>
          </div>
          <Badge className="hidden sm:inline-flex bg-[#01567A]/5 text-[#01567A] hover:bg-[#01567A]/5 border border-[#01567A]/15 gap-1.5">
            <ShieldCheck size={12} /> Halaman Publik
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-10 w-2/3 bg-gray-200" />
            <Skeleton className="h-64 bg-gray-200 rounded-xl" />
            <Skeleton className="h-64 bg-gray-200 rounded-xl" />
          </div>
        ) : error ? (
          <div className="sigma-card p-4">
            <EmptyState
              icon={AlertCircle}
              title={error}
              description="Pastikan QR code yang Anda scan valid, atau hubungi administrator aset."
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            data-testid="public-asset-page"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1F2937]" data-testid="public-asset-title">
                {asset.nama_aset}
              </h1>
              <span className="font-mono text-sm text-[#01567A] bg-[#01567A]/5 px-2.5 py-1 rounded-md border border-[#01567A]/10 self-start sm:self-auto">
                {asset.kode_aset}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {asset.current_office_name ? (
                <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30 gap-1">
                  <MapPin size={11} /> {locationLabel(asset.current_office_name, asset.current_room_name)}
                </Badge>
              ) : (
                <Badge className="bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                  Belum ditempatkan
                </Badge>
              )}
              {asset.status === "Lunas" && (
                <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30">Lunas</Badge>
              )}
              {asset.status === "Penyusutan" && (
                <Badge className="bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/10 border border-[#F59E0B]/30">Penyusutan</Badge>
              )}
              {asset.in_repair && (
                <Badge className="bg-[#DC2626]/10 text-[#B91C1C] hover:bg-[#DC2626]/10 border border-[#DC2626]/30 gap-1">
                  <Wrench size={11} /> Sedang Diperbaiki
                </Badge>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-5 mt-6">
              <div className="sigma-card p-5" data-testid="public-info-card">
                <h3 className="text-base font-medium text-[#1F2937] mb-2">Informasi Aset</h3>
                <div className="divide-y divide-[#E5E7EB]">
                  <InfoItem icon={Package} label="Nama Aset" value={asset.nama_aset} />
                  <InfoItem icon={History} label="Kode Aset" value={asset.kode_aset} mono />
                  <InfoItem icon={Tag} label="Jenis Inventaris" value={asset.jenis_inventaris} />
                  <InfoItem icon={Layers} label="Golongan" value={asset.golongan} />
                  <InfoItem
                    icon={Calendar}
                    label="Tanggal Pembelian"
                    value={asset.tanggal_pembelian ? formatDate(asset.tanggal_pembelian) : "-"}
                  />
                </div>
              </div>

              <div className="sigma-card p-5" data-testid="public-location-card">
                <h3 className="text-base font-medium text-[#1F2937] mb-2">Lokasi Saat Ini</h3>
                <div className="divide-y divide-[#E5E7EB]">
                  <InfoItem icon={Building2} label="Kantor" value={asset.current_office_name || "Belum ditempatkan"} />
                  <InfoItem icon={MapPin} label="Ruangan" value={asset.current_room_name} />
                  <InfoItem
                    icon={Clock}
                    label="Terakhir Dipindahkan"
                    value={asset.last_moved_at ? formatDateTime(asset.last_moved_at) : "Belum pernah dipindahkan"}
                  />
                  <InfoItem icon={History} label="Total Mutasi" value={`${asset.total_moves} perpindahan`} mono />
                </div>
              </div>
            </div>

            {/* Timeline Riwayat Perpindahan */}
            <section className="sigma-card p-5 sm:p-6 mt-6" data-testid="public-history-section">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-lg bg-[#01567A]/5 flex items-center justify-center">
                  <History size={18} className="text-[#01567A]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-[#1F2937]">
                  Riwayat Perpindahan
                </h2>
              </div>

              {history.length === 0 && !asset.current_office_name ? (
                <EmptyState
                  icon={Package}
                  title="Belum ada riwayat perpindahan"
                  description="Aset ini belum pernah dipindahkan sejak dicatat."
                  testId="public-history-empty"
                />
              ) : (
                <div className="relative" data-testid="public-history-timeline">
                  <div className="absolute left-[17px] top-6 bottom-6 w-px bg-[#E5E7EB]" aria-hidden="true" />
                  <div className="space-y-5">
                    {asset.current_office_name && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="relative pl-14"
                      >
                        <div className="absolute left-0 top-5 w-9 h-9 rounded-full flex items-center justify-center border-2 z-10 bg-[#92BA3C] border-[#92BA3C] text-white shadow-[0_0_0_4px_rgba(146,186,60,0.2)]">
                          <MapPin size={16} strokeWidth={2} />
                        </div>
                        <div className="sigma-card p-4 border-[#92BA3C]/40 bg-[#92BA3C]/[0.04]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge className="bg-[#92BA3C] hover:bg-[#92BA3C] text-white text-[10px] tracking-wider font-semibold">
                              POSISI SEKARANG
                            </Badge>
                            {asset.last_moved_at && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] font-mono">
                                <Clock size={12} />
                                {formatDateTime(asset.last_moved_at)}
                              </span>
                            )}
                          </div>
                          <div className="mt-3">
                            <LocationChip
                              officeName={asset.current_office_name}
                              roomName={asset.current_room_name}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {history.map((log, i) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: (i + 1) * 0.05 }}
                        className="relative pl-14"
                        data-testid={`public-timeline-item-${i}`}
                      >
                        <div className="absolute left-0 top-5 w-9 h-9 rounded-full flex items-center justify-center border-2 z-10 bg-white border-[#E5E7EB] text-[#01567A]">
                          <History size={16} strokeWidth={2} />
                        </div>
                        <div className="sigma-card p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] font-mono">
                              <Clock size={12} />
                              {formatDateTime(log.moved_at)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
                              <User size={12} />
                              {log.moved_by}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <LocationChip officeName={log.from_office_name} roomName={log.from_room_name} muted />
                            <ArrowRight size={14} className="text-[#92BA3C] shrink-0" strokeWidth={2.5} />
                            <LocationChip officeName={log.to_office_name} roomName={log.to_room_name} />
                          </div>
                          {log.notes && (
                            <p className="text-sm text-[#1F2937] mt-3 pt-3 border-t border-[#E5E7EB] leading-relaxed">
                              {log.notes}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Riwayat Perbaikan */}
            <section className="sigma-card p-5 sm:p-6 mt-6" data-testid="public-repair-section">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-lg bg-[#01567A]/5 flex items-center justify-center">
                  <Wrench size={18} className="text-[#01567A]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-[#1F2937]">
                  Riwayat Perbaikan
                </h2>
              </div>

              {repairs.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="Belum ada riwayat perbaikan"
                  description="Aset ini belum memiliki catatan perbaikan atau pemeliharaan."
                  testId="public-repair-empty"
                />
              ) : (
                <ul className="space-y-3">
                  {repairs.map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="sigma-card p-4"
                      data-testid={`public-repair-item-${i}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] font-mono">
                          <Calendar size={12} />
                          {formatDate(r.tanggal_perbaikan)}
                        </span>
                        {r.status === "Selesai" ? (
                          <Badge className="bg-[#92BA3C]/10 text-[#5a7822] hover:bg-[#92BA3C]/10 border border-[#92BA3C]/30">Selesai</Badge>
                        ) : (
                          <Badge className="bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/10 border border-[#F59E0B]/30">Dalam Perbaikan</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[#1F2937] mt-2">{r.deskripsi_kerusakan}</p>
                      {r.tindakan_perbaikan && (
                        <p className="text-sm text-[#6B7280] mt-1.5">
                          <span className="text-[#1F2937] font-medium">Tindakan: </span>
                          {r.tindakan_perbaikan}
                        </p>
                      )}
                      {r.teknisi && (
                        <p className="text-xs text-[#6B7280] mt-2 inline-flex items-center gap-1.5">
                          <User size={11} /> {r.teknisi}
                        </p>
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}
            </section>
          </motion.div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-[#6B7280]">
        © {new Date().getFullYear()} SIGMA — Sistem Informasi Manajemen Aset
      </footer>
    </div>
  );
}
