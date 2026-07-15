import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  onConfirm,
  destructive = false,
  loading = false,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent data-testid="confirm-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="confirm-dialog-cancel" disabled={loading}>
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          data-testid="confirm-dialog-confirm"
          disabled={loading}
          onClick={(e) => {
            e.preventDefault();
            onConfirm();
          }}
          className={
            destructive
              ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              : "bg-[#01567A] hover:bg-[#014462] text-white"
          }
        >
          {loading ? "Memproses..." : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
