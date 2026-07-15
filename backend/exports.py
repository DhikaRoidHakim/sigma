import csv
import io
from openpyxl import Workbook, load_workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

PRIMARY = colors.HexColor("#01567A")
BORDER = colors.HexColor("#E5E7EB")

ASSET_COLUMNS = [
    ("kode_aset", "Kode Aset"),
    ("nama_aset", "Nama Aset"),
    ("jenis_inventaris", "Jenis Inventaris"),
    ("golongan", "Golongan"),
    ("tanggal_pembelian", "Tanggal Pembelian"),
    ("nilai_pembelian", "Nilai Pembelian"),
    ("status", "Status"),
    ("current_office_name", "Kantor"),
    ("current_room_name", "Ruangan"),
]

HISTORY_COLUMNS = [
    ("moved_at", "Tanggal"),
    ("from_office_name", "Dari Kantor"),
    ("from_room_name", "Dari Ruangan"),
    ("to_office_name", "Ke Kantor"),
    ("to_room_name", "Ke Ruangan"),
    ("moved_by", "Dipindahkan Oleh"),
    ("notes", "Catatan"),
]

REPAIR_COLUMNS = [
    ("tanggal_perbaikan", "Tanggal"),
    ("deskripsi_kerusakan", "Deskripsi Kerusakan"),
    ("tindakan_perbaikan", "Tindakan Perbaikan"),
    ("biaya", "Biaya"),
    ("teknisi", "Teknisi/Vendor"),
    ("status", "Status"),
    ("created_by", "Dicatat Oleh"),
]


def _fmt(value):
    if value is None:
        return ""
    return str(value)


def rows_to_csv(rows: list, columns: list) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([label for _, label in columns])
    for row in rows:
        writer.writerow([_fmt(row.get(key)) for key, _ in columns])
    return buf.getvalue().encode("utf-8-sig")


def rows_to_xlsx(rows: list, columns: list, sheet_title: str = "Data") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_title
    ws.append([label for _, label in columns])
    for row in rows:
        ws.append([row.get(key) if row.get(key) is not None else "" for key, _ in columns])
    for i, (_, label) in enumerate(columns, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = max(16, len(label) + 4)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def rows_to_pdf(rows: list, columns: list, title: str, subtitle: str = "") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=15 * mm, bottomMargin=15 * mm,
                            leftMargin=12 * mm, rightMargin=12 * mm)
    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle("cell", parent=styles["Normal"], fontSize=8, leading=10)
    header_style = ParagraphStyle("header", parent=styles["Normal"], fontSize=8, leading=10,
                                  textColor=colors.white, fontName="Helvetica-Bold")
    elements = [
        Paragraph(f"SIGMA — {title}", ParagraphStyle("title", parent=styles["Title"], fontSize=16, textColor=PRIMARY)),
    ]
    if subtitle:
        elements.append(Paragraph(subtitle, ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#6B7280"))))
    elements.append(Spacer(1, 6 * mm))

    data = [[Paragraph(label, header_style) for _, label in columns]]
    for row in rows:
        data.append([Paragraph(_fmt(row.get(key)), cell_style) for key, _ in columns])

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()


IMPORT_FIELDS = ["kode_aset", "nama_aset", "jenis_inventaris", "golongan",
                 "tanggal_pembelian", "nilai_pembelian", "status", "nama_kantor", "nama_ruangan"]

HEADER_ALIASES = {label.lower(): key for key, label in ASSET_COLUMNS}
HEADER_ALIASES.update({key: key for key in IMPORT_FIELDS})
HEADER_ALIASES.update({"kantor": "nama_kantor", "ruangan": "nama_ruangan",
                       "nama_kantor": "nama_kantor", "nama_ruangan": "nama_ruangan"})


def _normalize_headers(headers: list) -> list:
    return [HEADER_ALIASES.get(str(h or "").strip().lower(), str(h or "").strip().lower()) for h in headers]


def parse_upload(filename: str, content: bytes) -> list:
    name = (filename or "").lower()
    if name.endswith(".xlsx"):
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        try:
            headers = _normalize_headers(list(next(rows_iter)))
        except StopIteration:
            return []
        rows = []
        for raw in rows_iter:
            if raw is None or all(v is None or str(v).strip() == "" for v in raw):
                continue
            rows.append({headers[i]: raw[i] for i in range(min(len(headers), len(raw)))})
        return rows
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    all_rows = [r for r in reader if any(str(c).strip() for c in r)]
    if not all_rows:
        return []
    headers = _normalize_headers(all_rows[0])
    return [{headers[i]: row[i] for i in range(min(len(headers), len(row)))} for row in all_rows[1:]]
