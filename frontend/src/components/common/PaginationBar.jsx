import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PaginationBar = ({ page, pages, total, onPageChange, label = "data" }) => {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between gap-4 pt-4" data-testid="pagination-bar">
      <p className="text-xs text-[#6B7280]">
        Halaman <span className="font-medium text-[#1F2937]">{page}</span> dari {pages} · {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid="pagination-prev"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="border-[#E5E7EB]"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="pagination-next"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="border-[#E5E7EB]"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};
