import { motion } from "framer-motion";
import { Building2, MapPin, ArrowRight, Clock, User, History, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime, locationLabel } from "@/lib/format";

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

const TimelineNode = ({ current = false, icon: Icon }) => (
  <div
    className={`absolute left-0 top-5 w-9 h-9 rounded-full flex items-center justify-center border-2 z-10 ${
      current
        ? "bg-[#92BA3C] border-[#92BA3C] text-white shadow-[0_0_0_4px_rgba(146,186,60,0.2)]"
        : "bg-white border-[#E5E7EB] text-[#01567A]"
    }`}
  >
    <Icon size={16} strokeWidth={2} />
  </div>
);

export const HistoryTimeline = ({ asset, logs, loading, isFirstPageUnfiltered }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
            <Skeleton className="h-28 flex-1 bg-gray-200 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!logs.length && !isFirstPageUnfiltered) {
    return (
      <EmptyState
        icon={History}
        title="Tidak ada riwayat ditemukan"
        description="Tidak ada perpindahan yang cocok dengan filter yang dipilih."
        testId="history-empty-filtered"
      />
    );
  }

  if (!logs.length) {
    return (
      <div>
        {isFirstPageUnfiltered && <CurrentPositionCard asset={asset} standalone />}
        <EmptyState
          icon={Package}
          title="Belum ada riwayat perpindahan"
          description="Aset ini belum pernah dipindahkan. Gunakan form Mutasi Asset untuk mencatat perpindahan pertama."
          testId="history-empty"
        />
      </div>
    );
  }

  return (
    <div className="relative" data-testid="history-timeline">
      <div className="absolute left-[17px] top-6 bottom-6 w-px bg-[#E5E7EB]" aria-hidden="true" />
      <div className="space-y-5">
        {isFirstPageUnfiltered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative pl-14"
          >
            <TimelineNode current icon={MapPin} />
            <CurrentPositionCard asset={asset} />
          </motion.div>
        )}
        {logs.map((log, i) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: (i + 1) * 0.07 }}
            className="relative pl-14"
            data-testid={`timeline-item-${i}`}
          >
            <TimelineNode icon={History} />
            <div className="sigma-card p-4 hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)] transition-shadow">
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
  );
};

const CurrentPositionCard = ({ asset, standalone = false }) => (
  <div
    className={`sigma-card p-4 border-[#92BA3C]/40 bg-[#92BA3C]/[0.04] ${standalone ? "mb-2" : ""}`}
    data-testid="current-position-card"
  >
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
      {asset.current_office_name ? (
        <LocationChip officeName={asset.current_office_name} roomName={asset.current_room_name} />
      ) : (
        <p className="text-sm text-[#F59E0B] font-medium">
          {locationLabel(asset.current_office_name, asset.current_room_name)}
        </p>
      )}
    </div>
  </div>
);
