export function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function locationLabel(officeName, roomName) {
  if (!officeName && !roomName) return "Belum ditempatkan";
  if (officeName && roomName) return `${officeName} · ${roomName}`;
  return officeName || roomName;
}
