"""Tests for iteration 4 features: QR codes, single label PDF, bulk labels PDF."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sigma-asset-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@sigma.co.id"
ADMIN_PASSWORD = "Sigma@2026"
STAFF_EMAIL = "staff@sigma.co.id"
STAFF_PASSWORD = "Staff@2026"

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PDF_MAGIC = b"%PDF"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def staff():
    return _login(STAFF_EMAIL, STAFF_PASSWORD)


@pytest.fixture(scope="module")
def sample_asset_id(admin):
    lst = admin.get(f"{API}/assets", params={"search": "AST-001"}, timeout=15).json()["items"]
    if lst:
        return lst[0]["id"]
    any_list = admin.get(f"{API}/assets", params={"page": 1, "limit": 1}, timeout=15).json()["items"]
    assert any_list, "no assets found in DB"
    return any_list[0]["id"]


# ---------- QR PNG endpoint ----------
class TestQrPng:
    def test_qr_png_success(self, admin, sample_asset_id):
        r = admin.get(f"{API}/assets/{sample_asset_id}/qrcode", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        assert r.content[:8] == PNG_MAGIC
        assert len(r.content) > 200  # non-empty PNG

    def test_qr_png_staff_allowed(self, staff, sample_asset_id):
        r = staff.get(f"{API}/assets/{sample_asset_id}/qrcode", timeout=15)
        assert r.status_code == 200
        assert r.content[:8] == PNG_MAGIC

    def test_qr_png_unauthenticated_401(self, sample_asset_id):
        r = requests.get(f"{API}/assets/{sample_asset_id}/qrcode", timeout=15)
        assert r.status_code == 401

    def test_qr_png_unknown_asset_404(self, admin):
        r = admin.get(f"{API}/assets/does-not-exist-xyz/qrcode", timeout=15)
        assert r.status_code == 404


# ---------- Single label PDF ----------
class TestSingleLabelPdf:
    def test_single_label_success(self, admin, sample_asset_id):
        r = admin.get(f"{API}/assets/{sample_asset_id}/label", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == PDF_MAGIC
        cd = r.headers.get("content-disposition", "")
        assert "label-" in cd and ".pdf" in cd

    def test_single_label_staff_allowed(self, staff, sample_asset_id):
        r = staff.get(f"{API}/assets/{sample_asset_id}/label", timeout=20)
        assert r.status_code == 200
        assert r.content[:4] == PDF_MAGIC

    def test_single_label_unauthenticated_401(self, sample_asset_id):
        r = requests.get(f"{API}/assets/{sample_asset_id}/label", timeout=15)
        assert r.status_code == 401

    def test_single_label_unknown_404(self, admin):
        r = admin.get(f"{API}/assets/bogus-id-zzz/label", timeout=15)
        assert r.status_code == 404


# ---------- Bulk labels PDF ----------
class TestBulkLabels:
    def test_bulk_labels_success(self, admin):
        r = admin.get(f"{API}/assets/labels/export", timeout=45)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == PDF_MAGIC
        assert len(r.content) > 1000  # PDF should have substantial content

    def test_bulk_labels_staff_allowed(self, staff):
        r = staff.get(f"{API}/assets/labels/export", timeout=45)
        assert r.status_code == 200
        assert r.content[:4] == PDF_MAGIC

    def test_bulk_labels_unauthenticated_401(self):
        r = requests.get(f"{API}/assets/labels/export", timeout=15)
        assert r.status_code == 401

    def test_bulk_labels_route_not_swallowed(self, admin):
        # Critical: /assets/labels/export must NOT be captured by /assets/{asset_id}
        # If it were, admin would get 404 (asset "labels" not found)
        r = admin.get(f"{API}/assets/labels/export", timeout=45)
        assert r.status_code == 200
        # And the asset-detail path for a real asset should still work
        assets = admin.get(f"{API}/assets", params={"page": 1, "limit": 1}, timeout=15).json()["items"]
        if assets:
            g = admin.get(f"{API}/assets/{assets[0]['id']}", timeout=15)
            assert g.status_code == 200


# ---------- Viewer role permission matrix ----------
class TestViewerAccess:
    """Viewer role has only assets.view - should still access QR/label endpoints."""

    @pytest.fixture(scope="class")
    def viewer_session(self, request):
        admin = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        roles = admin.get(f"{API}/roles", timeout=15).json()
        viewer = next((r for r in roles if r["name"].lower() == "viewer"), None)
        if not viewer:
            pytest.skip("Viewer role not found")

        email = f"test_viewer_{uuid.uuid4().hex[:6]}@sigma.co.id"
        password = "ViewerTest@2026"
        cr = admin.post(f"{API}/users", json={
            "name": "TEST Viewer QR",
            "email": email,
            "password": password,
            "role_id": viewer["id"],
        }, timeout=15)
        assert cr.status_code == 201, cr.text
        user_id = cr.json()["id"]

        def _cleanup():
            admin.delete(f"{API}/users/{user_id}", timeout=15)

        request.addfinalizer(_cleanup)

        s = _login(email, password)
        return s

    def test_viewer_can_fetch_qr_png(self, viewer_session, sample_asset_id):
        r = viewer_session.get(f"{API}/assets/{sample_asset_id}/qrcode", timeout=15)
        assert r.status_code == 200
        assert r.content[:8] == PNG_MAGIC

    def test_viewer_can_fetch_single_label(self, viewer_session, sample_asset_id):
        r = viewer_session.get(f"{API}/assets/{sample_asset_id}/label", timeout=20)
        assert r.status_code == 200
        assert r.content[:4] == PDF_MAGIC

    def test_viewer_can_fetch_bulk_labels(self, viewer_session):
        r = viewer_session.get(f"{API}/assets/labels/export", timeout=45)
        assert r.status_code == 200
        assert r.content[:4] == PDF_MAGIC

    def test_viewer_cannot_delete_asset(self, viewer_session, sample_asset_id):
        # sanity: viewer really is restricted
        r = viewer_session.delete(f"{API}/assets/{sample_asset_id}", timeout=15)
        assert r.status_code == 403


# ---------- FRONTEND_URL / QR content encoding ----------
class TestQrEncodesFrontendUrl:
    def test_qr_content_contains_frontend_url(self, admin, sample_asset_id):
        """Decode the QR PNG and assert it encodes FRONTEND_URL/assets/{id}."""
        try:
            from PIL import Image
            from pyzbar.pyzbar import decode  # optional
        except ImportError:
            pytest.skip("pyzbar not installed for QR decoding")

        import io as _io
        r = admin.get(f"{API}/assets/{sample_asset_id}/qrcode", timeout=15)
        assert r.status_code == 200
        img = Image.open(_io.BytesIO(r.content))
        results = decode(img)
        assert results, "QR could not be decoded"
        payload = results[0].data.decode()
        assert sample_asset_id in payload
        assert "/assets/" in payload
