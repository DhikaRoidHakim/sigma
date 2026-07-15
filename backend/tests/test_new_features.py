"""Tests for iteration 2 features: repairs, asset new fields, exports, imports."""
import io
import os
import csv
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sigma-asset-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@sigma.co.id"
ADMIN_PASSWORD = "Sigma@2026"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def seed_ctx(admin):
    offices = admin.get(f"{API}/offices", timeout=15).json()
    office = next((o for o in offices if o["nama_kantor"] == "Kantor Pusat Jakarta"), offices[0])
    rooms = admin.get(f"{API}/rooms", params={"office_id": office["id"]}, timeout=15).json()
    return {"office": office, "room": rooms[0]}


@pytest.fixture(scope="module")
def temp_asset(admin, seed_ctx):
    kode = f"TEST-{uuid.uuid4().hex[:6]}"
    body = {
        "kode_aset": kode,
        "nama_aset": "TEST New Fields Asset",
        "jenis_inventaris": "Elektronik",
        "golongan": "Golongan 2",
        "tanggal_pembelian": "2024-01-15",
        "nilai_pembelian": 5500000,
        "status": "Lunas",
        "office_id": seed_ctx["office"]["id"],
        "room_id": seed_ctx["room"]["id"],
    }
    r = admin.post(f"{API}/assets", json=body, timeout=15)
    assert r.status_code == 201, r.text
    data = r.json()
    yield data
    admin.delete(f"{API}/assets/{data['id']}", timeout=15)


# ---------- Asset new fields ----------
class TestAssetNewFields:
    def test_new_fields_persist_on_create(self, temp_asset):
        assert temp_asset["jenis_inventaris"] == "Elektronik"
        assert temp_asset["golongan"] == "Golongan 2"
        assert temp_asset["tanggal_pembelian"] == "2024-01-15"
        assert temp_asset["nilai_pembelian"] == 5500000
        assert temp_asset["status"] == "Lunas"

    def test_get_detail_returns_new_fields(self, admin, temp_asset):
        r = admin.get(f"{API}/assets/{temp_asset['id']}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["jenis_inventaris"] == "Elektronik"
        assert d["golongan"] == "Golongan 2"
        assert d["status"] == "Lunas"
        assert d["nilai_pembelian"] == 5500000
        assert "in_repair" in d
        assert "total_repairs" in d

    def test_update_persists_new_fields(self, admin, temp_asset):
        r = admin.put(f"{API}/assets/{temp_asset['id']}", json={
            "kode_aset": temp_asset["kode_aset"],
            "nama_aset": temp_asset["nama_aset"],
            "jenis_inventaris": "Furniture",
            "golongan": "Golongan 3",
            "tanggal_pembelian": "2023-06-01",
            "nilai_pembelian": 1200000,
            "status": "Penyusutan",
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "Penyusutan"
        assert r.json()["jenis_inventaris"] == "Furniture"

        # verify persisted
        g = admin.get(f"{API}/assets/{temp_asset['id']}", timeout=15).json()
        assert g["status"] == "Penyusutan"
        assert g["golongan"] == "Golongan 3"
        assert g["nilai_pembelian"] == 1200000

    def test_invalid_status_returns_422(self, admin):
        kode = f"TEST-{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{API}/assets", json={
            "kode_aset": kode, "nama_aset": "TEST Invalid Status", "status": "Rusak",
        }, timeout=15)
        assert r.status_code == 422

    def test_negative_nilai_returns_422(self, admin):
        kode = f"TEST-{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{API}/assets", json={
            "kode_aset": kode, "nama_aset": "TEST Neg", "nilai_pembelian": -1,
        }, timeout=15)
        assert r.status_code == 422


# ---------- Repairs API ----------
class TestRepairs:
    def test_create_and_list(self, admin, temp_asset):
        body = {
            "tanggal_perbaikan": "2025-05-10",
            "deskripsi_kerusakan": "Layar berkedip",
            "tindakan_perbaikan": "Ganti kabel display",
            "biaya": 150000,
            "teknisi": "TEST Teknisi A",
            "status": "Dalam Perbaikan",
        }
        r = admin.post(f"{API}/assets/{temp_asset['id']}/repairs", json=body, timeout=15)
        assert r.status_code == 201, r.text
        rep = r.json()
        assert rep["deskripsi_kerusakan"] == "Layar berkedip"
        assert rep["status"] == "Dalam Perbaikan"
        assert rep["asset_id"] == temp_asset["id"]
        assert rep["created_by"] == "Administrator"
        rid = rep["id"]

        # list
        lst = admin.get(f"{API}/assets/{temp_asset['id']}/repairs", params={"page": 1, "limit": 5}, timeout=15).json()
        assert lst["total"] >= 1
        assert any(x["id"] == rid for x in lst["items"])
        assert lst["limit"] == 5

        # asset now in_repair
        det = admin.get(f"{API}/assets/{temp_asset['id']}", timeout=15).json()
        assert det["in_repair"] is True
        assert det["total_repairs"] >= 1

        # update to Selesai
        upd = admin.put(f"{API}/repairs/{rid}", json={**body, "status": "Selesai",
                                                     "tindakan_perbaikan": "Selesai diganti"}, timeout=15)
        assert upd.status_code == 200
        assert upd.json()["status"] == "Selesai"

        # in_repair now false
        det2 = admin.get(f"{API}/assets/{temp_asset['id']}", timeout=15).json()
        assert det2["in_repair"] is False

        # delete
        d = admin.delete(f"{API}/repairs/{rid}", timeout=15)
        assert d.status_code == 200

        # verify removed
        lst2 = admin.get(f"{API}/assets/{temp_asset['id']}/repairs", timeout=15).json()
        assert not any(x["id"] == rid for x in lst2["items"])

    def test_desc_too_short_422(self, admin, temp_asset):
        r = admin.post(f"{API}/assets/{temp_asset['id']}/repairs", json={
            "tanggal_perbaikan": "2025-05-10",
            "deskripsi_kerusakan": "ab",  # < 3
            "status": "Selesai",
        }, timeout=15)
        assert r.status_code == 422

    def test_invalid_status_422(self, admin, temp_asset):
        r = admin.post(f"{API}/assets/{temp_asset['id']}/repairs", json={
            "tanggal_perbaikan": "2025-05-10",
            "deskripsi_kerusakan": "test issue",
            "status": "Menunggu",
        }, timeout=15)
        assert r.status_code == 422

    def test_negative_biaya_422(self, admin, temp_asset):
        r = admin.post(f"{API}/assets/{temp_asset['id']}/repairs", json={
            "tanggal_perbaikan": "2025-05-10",
            "deskripsi_kerusakan": "test issue",
            "biaya": -100,
            "status": "Selesai",
        }, timeout=15)
        assert r.status_code == 422

    def test_asset_not_found_404(self, admin):
        r = admin.post(f"{API}/assets/bogus/repairs", json={
            "tanggal_perbaikan": "2025-05-10",
            "deskripsi_kerusakan": "issue",
            "status": "Selesai",
        }, timeout=15)
        assert r.status_code == 404

    def test_list_repairs_unknown_asset_404(self, admin):
        r = admin.get(f"{API}/assets/bogus/repairs", timeout=15)
        assert r.status_code == 404

    def test_update_unknown_repair_404(self, admin):
        r = admin.put(f"{API}/repairs/bogus", json={
            "tanggal_perbaikan": "2025-05-10",
            "deskripsi_kerusakan": "issue",
            "status": "Selesai",
        }, timeout=15)
        assert r.status_code == 404

    def test_delete_unknown_repair_404(self, admin):
        r = admin.delete(f"{API}/repairs/bogus", timeout=15)
        assert r.status_code == 404


# ---------- Exports ----------
class TestExports:
    def test_assets_export_csv(self, admin):
        r = admin.get(f"{API}/assets/export", params={"format": "csv"}, timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        text = r.content.decode("utf-8-sig")
        first_line = text.splitlines()[0]
        for label in ("Kode Aset", "Nama Aset", "Kantor", "Ruangan"):
            assert label in first_line

    def test_assets_export_xlsx(self, admin):
        r = admin.get(f"{API}/assets/export", params={"format": "xlsx"}, timeout=30)
        assert r.status_code == 200
        # xlsx = ZIP magic bytes
        assert r.content[:2] == b"PK"

    def test_assets_export_invalid_format(self, admin):
        r = admin.get(f"{API}/assets/export", params={"format": "docx"}, timeout=15)
        assert r.status_code == 422

    def test_assets_export_route_not_swallowed(self, admin):
        # Route order: /assets/export must not match /assets/{asset_id} → we should NOT get 404
        r = admin.get(f"{API}/assets/export", timeout=15)
        assert r.status_code == 200

    def test_history_export_csv_and_pdf(self, admin):
        # AST-001 has history
        assets = admin.get(f"{API}/assets", params={"search": "AST-001"}, timeout=15).json()["items"]
        aid = assets[0]["id"]
        rc = admin.get(f"{API}/assets/{aid}/history/export", params={"format": "csv"}, timeout=30)
        assert rc.status_code == 200
        assert "Tanggal" in rc.content.decode("utf-8-sig").splitlines()[0]

        rp = admin.get(f"{API}/assets/{aid}/history/export", params={"format": "pdf"}, timeout=30)
        assert rp.status_code == 200
        assert rp.content[:4] == b"%PDF"

        # invalid
        ri = admin.get(f"{API}/assets/{aid}/history/export", params={"format": "xlsx"}, timeout=15)
        assert ri.status_code == 422

    def test_repairs_export_csv_and_pdf(self, admin, temp_asset):
        # add a repair first so PDF has content
        admin.post(f"{API}/assets/{temp_asset['id']}/repairs", json={
            "tanggal_perbaikan": "2025-04-01",
            "deskripsi_kerusakan": "TEST for export",
            "status": "Selesai",
        }, timeout=15)

        rc = admin.get(f"{API}/assets/{temp_asset['id']}/repairs/export", params={"format": "csv"}, timeout=30)
        assert rc.status_code == 200
        header = rc.content.decode("utf-8-sig").splitlines()[0]
        for label in ("Tanggal", "Deskripsi Kerusakan", "Biaya", "Status"):
            assert label in header

        rp = admin.get(f"{API}/assets/{temp_asset['id']}/repairs/export", params={"format": "pdf"}, timeout=30)
        assert rp.status_code == 200
        assert rp.content[:4] == b"%PDF"

        ri = admin.get(f"{API}/assets/{temp_asset['id']}/repairs/export", params={"format": "xlsx"}, timeout=15)
        assert ri.status_code == 422


# ---------- Import ----------
class TestImport:
    def test_import_csv_mixed_new_skip_error(self, admin, seed_ctx):
        office_name = seed_ctx["office"]["nama_kantor"]
        room_name = seed_ctx["room"]["nama_ruangan"]
        new_kode = f"TEST-IMP-{uuid.uuid4().hex[:6]}"

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["kode_aset", "nama_aset", "jenis_inventaris", "golongan",
                    "tanggal_pembelian", "nilai_pembelian", "status",
                    "nama_kantor", "nama_ruangan"])
        # Valid new row
        w.writerow([new_kode, "TEST Imported Meja", "Furniture", "Golongan 1",
                    "2024-03-01", "500000", "Lunas", office_name, room_name])
        # Existing kode → SKIP
        w.writerow(["AST-001", "Duplicate", "Elektronik", "Golongan 2",
                    "2024-01-01", "1000000", "Penyusutan", office_name, room_name])
        # Invalid status → ERROR
        w.writerow([f"TEST-IMP-{uuid.uuid4().hex[:6]}", "TEST Bad Status", "", "", "", "", "Rusak", "", ""])

        content = buf.getvalue().encode("utf-8")
        files = {"file": ("test_import.csv", content, "text/csv")}
        r = admin.post(f"{API}/assets/import", files=files, timeout=30)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["total_rows"] == 3
        assert rep["imported"] == 1
        assert rep["skipped"] == 1
        assert len(rep["errors"]) == 1
        assert rep["errors"][0]["row"] == 4

        # verify new asset actually created
        lst = admin.get(f"{API}/assets", params={"search": new_kode}, timeout=15).json()["items"]
        assert len(lst) == 1
        created = lst[0]
        assert created["nama_aset"] == "TEST Imported Meja"
        assert created["status"] == "Lunas"
        assert created["current_office_id"] == seed_ctx["office"]["id"]
        assert created["current_room_id"] == seed_ctx["room"]["id"]
        # cleanup
        admin.delete(f"{API}/assets/{created['id']}", timeout=15)

    def test_import_xlsx(self, admin, seed_ctx):
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["kode_aset", "nama_aset", "jenis_inventaris", "golongan",
                   "tanggal_pembelian", "nilai_pembelian", "status",
                   "nama_kantor", "nama_ruangan"])
        new_kode = f"TEST-XLSX-{uuid.uuid4().hex[:6]}"
        ws.append([new_kode, "TEST Imported XLSX", "Elektronik", "Golongan 4",
                   "2024-02-02", 750000, "Penyusutan",
                   seed_ctx["office"]["nama_kantor"], seed_ctx["room"]["nama_ruangan"]])
        buf = io.BytesIO()
        wb.save(buf)
        files = {"file": ("test.xlsx", buf.getvalue(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = admin.post(f"{API}/assets/import", files=files, timeout=30)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["imported"] == 1

        # cleanup
        lst = admin.get(f"{API}/assets", params={"search": new_kode}, timeout=15).json()["items"]
        if lst:
            admin.delete(f"{API}/assets/{lst[0]['id']}", timeout=15)

    def test_import_bad_extension_422(self, admin):
        files = {"file": ("hello.txt", b"not a csv", "text/plain")}
        r = admin.post(f"{API}/assets/import", files=files, timeout=15)
        assert r.status_code == 422

    def test_import_empty_csv_422(self, admin):
        files = {"file": ("empty.csv", b"", "text/csv")}
        r = admin.post(f"{API}/assets/import", files=files, timeout=15)
        assert r.status_code == 422
