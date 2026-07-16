"""SIGMA iteration 3 tests: RBAC — permissions catalog, roles CRUD, users CRUD,
permission enforcement (staff 200/403), auth changes (register removed, role_name/permissions
in login+me), self-protection rules, live role revocation."""
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

ALL_PERMISSION_KEYS = [
    "assets.view", "assets.manage", "assets.delete", "assets.move", "assets.import_export",
    "repairs.manage", "offices.manage", "rooms.manage", "users.manage", "roles.manage",
]


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def staff():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def seed_ctx(admin):
    offices = admin.get(f"{API}/offices", timeout=15).json()
    office = next((o for o in offices if o["nama_kantor"] == "Kantor Pusat Jakarta"), offices[0])
    rooms = admin.get(f"{API}/rooms", params={"office_id": office["id"]}, timeout=15).json()
    assets = admin.get(f"{API}/assets", params={"limit": 3}, timeout=15).json()["items"]
    return {"office": office, "room": rooms[0], "asset_id": assets[0]["id"]}


@pytest.fixture(scope="module")
def role_ids(admin):
    roles = admin.get(f"{API}/roles", timeout=15).json()
    return {r["name"]: r["id"] for r in roles}


# ---------- Auth changes ----------
class TestAuthChanges:
    def test_register_removed(self):
        r = requests.post(f"{API}/auth/register",
                          json={"name": "x", "email": "TEST_reg@x.com", "password": "abcdef"}, timeout=15)
        assert r.status_code == 404

    def test_login_returns_role_and_permissions(self, admin):
        r = admin.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role_name"] == "Administrator"
        assert set(ALL_PERMISSION_KEYS).issubset(set(d["permissions"]))
        assert d["is_active"] is True

    def test_staff_login_permissions(self, staff):
        d = staff.get(f"{API}/auth/me", timeout=15).json()
        assert d["role_name"] == "Staff"
        assert set(d["permissions"]) == {"assets.view", "assets.manage", "assets.move", "repairs.manage"}

    def test_unauthenticated_401(self):
        assert requests.get(f"{API}/assets", timeout=15).status_code == 401
        assert requests.get(f"{API}/users", timeout=15).status_code == 401
        assert requests.get(f"{API}/roles", timeout=15).status_code == 401


# ---------- Staff permission enforcement ----------
class TestStaffEnforcement:
    def test_staff_allowed_endpoints(self, staff, seed_ctx):
        # GET /assets
        assert staff.get(f"{API}/assets", timeout=15).status_code == 200
        # POST /assets
        kode = f"TEST-S-{uuid.uuid4().hex[:6]}"
        r = staff.post(f"{API}/assets", json={"kode_aset": kode, "nama_aset": "TEST Staff Asset"}, timeout=15)
        assert r.status_code == 201
        aid = r.json()["id"]
        # move
        rm = staff.post(f"{API}/assets/{aid}/move",
                        json={"office_id": seed_ctx["office"]["id"], "room_id": seed_ctx["room"]["id"]}, timeout=15)
        assert rm.status_code == 200
        # repair create + update + delete
        rep = staff.post(f"{API}/assets/{aid}/repairs",
                        json={"tanggal_perbaikan": "2025-06-01",
                              "deskripsi_kerusakan": "TEST staff repair", "status": "Selesai"}, timeout=15)
        assert rep.status_code == 201
        rid = rep.json()["id"]
        assert staff.put(f"{API}/repairs/{rid}",
                         json={"tanggal_perbaikan": "2025-06-01",
                               "deskripsi_kerusakan": "TEST staff repair upd", "status": "Selesai"},
                         timeout=15).status_code == 200
        assert staff.delete(f"{API}/repairs/{rid}", timeout=15).status_code == 200
        # cleanup asset (via admin since staff has no delete perm)
        # we need admin — use raw request with admin cookies? Instead just skip; admin fixture is module scoped in another test.
        # Cleanup via a fresh admin session:
        adm = requests.Session()
        adm.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        adm.delete(f"{API}/assets/{aid}", timeout=15)

    def test_staff_denied_endpoints(self, staff, seed_ctx):
        aid = seed_ctx["asset_id"]
        # DELETE asset → 403
        assert staff.delete(f"{API}/assets/{aid}", timeout=15).status_code == 403
        # export → 403
        assert staff.get(f"{API}/assets/export", params={"format": "csv"}, timeout=15).status_code == 403
        # import → 403
        files = {"file": ("empty.csv", b"a,b\n1,2\n", "text/csv")}
        assert staff.post(f"{API}/assets/import", files=files, timeout=15).status_code == 403
        # offices/rooms POST/PUT/DELETE → 403
        assert staff.post(f"{API}/offices", json={"nama_kantor": "TEST_x"}, timeout=15).status_code == 403
        assert staff.put(f"{API}/offices/{seed_ctx['office']['id']}",
                         json={"nama_kantor": "TEST_x"}, timeout=15).status_code == 403
        assert staff.delete(f"{API}/offices/{seed_ctx['office']['id']}", timeout=15).status_code == 403
        assert staff.post(f"{API}/rooms",
                          json={"office_id": seed_ctx["office"]["id"], "nama_ruangan": "TEST_r"},
                          timeout=15).status_code == 403
        # users, roles → 403
        assert staff.get(f"{API}/users", timeout=15).status_code == 403
        assert staff.get(f"{API}/roles", timeout=15).status_code == 403
        assert staff.get(f"{API}/permissions", timeout=15).status_code == 403

    def test_staff_403_message(self, staff, seed_ctx):
        r = staff.delete(f"{API}/assets/{seed_ctx['asset_id']}", timeout=15)
        assert r.status_code == 403
        assert "izin" in r.json().get("detail", "").lower()


# ---------- Permissions catalog ----------
class TestPermissionsCatalog:
    def test_permissions_returns_10(self, admin):
        r = admin.get(f"{API}/permissions", timeout=15)
        assert r.status_code == 200
        perms = r.json()
        assert len(perms) == 10
        keys = [p["key"] for p in perms]
        assert set(keys) == set(ALL_PERMISSION_KEYS)
        for p in perms:
            assert "label" in p and "group" in p


# ---------- Roles CRUD ----------
class TestRolesCrud:
    def test_list_roles_has_seeded(self, admin):
        roles = admin.get(f"{API}/roles", timeout=15).json()
        names = {r["name"] for r in roles}
        assert {"Administrator", "Staff", "Viewer"}.issubset(names)
        admin_role = next(r for r in roles if r["name"] == "Administrator")
        assert admin_role["is_system"] is True
        assert "jumlah_user" in admin_role
        assert admin_role["jumlah_user"] >= 1

    def test_create_role_invalid_permission_422(self, admin):
        r = admin.post(f"{API}/roles", json={
            "name": f"TEST_Role_{uuid.uuid4().hex[:6]}",
            "permissions": ["nonsense.perm"],
        }, timeout=15)
        assert r.status_code == 422

    def test_create_role_empty_permissions_422(self, admin):
        r = admin.post(f"{API}/roles", json={
            "name": f"TEST_Role_{uuid.uuid4().hex[:6]}", "permissions": [],
        }, timeout=15)
        assert r.status_code == 422

    def test_create_role_duplicate_name_422(self, admin):
        r = admin.post(f"{API}/roles", json={
            "name": "Administrator", "permissions": ["assets.view"],
        }, timeout=15)
        assert r.status_code == 422

    def test_role_full_crud_and_updates(self, admin):
        name = f"TEST_Role_{uuid.uuid4().hex[:6]}"
        # create
        r = admin.post(f"{API}/roles", json={
            "name": name, "description": "TEST role",
            "permissions": ["assets.view", "assets.manage"],
        }, timeout=15)
        assert r.status_code == 201, r.text
        rid = r.json()["id"]
        assert r.json()["is_system"] is False
        # verify via list
        roles = admin.get(f"{API}/roles", timeout=15).json()
        assert any(x["id"] == rid and x["name"] == name for x in roles)

        # update
        new_name = name + "_upd"
        u = admin.put(f"{API}/roles/{rid}", json={
            "name": new_name, "description": "upd",
            "permissions": ["assets.view", "repairs.manage"],
        }, timeout=15)
        assert u.status_code == 200
        assert u.json()["name"] == new_name
        assert set(u.json()["permissions"]) == {"assets.view", "repairs.manage"}

        # delete
        d = admin.delete(f"{API}/roles/{rid}", timeout=15)
        assert d.status_code == 200

    def test_update_system_role_422(self, admin, role_ids):
        r = admin.put(f"{API}/roles/{role_ids['Administrator']}", json={
            "name": "Administrator", "permissions": ["assets.view"],
        }, timeout=15)
        assert r.status_code == 422

    def test_delete_system_role_422(self, admin, role_ids):
        r = admin.delete(f"{API}/roles/{role_ids['Administrator']}", timeout=15)
        assert r.status_code == 422

    def test_delete_role_with_users_422(self, admin, role_ids):
        # Staff role is used by staff@sigma.co.id → cannot delete
        r = admin.delete(f"{API}/roles/{role_ids['Staff']}", timeout=15)
        assert r.status_code == 422


# ---------- Users CRUD ----------
class TestUsersCrud:
    def test_list_users_has_seeded(self, admin):
        users = admin.get(f"{API}/users", timeout=15).json()
        emails = {u["email"] for u in users}
        assert ADMIN_EMAIL in emails and STAFF_EMAIL in emails
        for u in users:
            assert "role_name" in u and "is_active" in u

    def test_create_user_and_verify(self, admin, role_ids):
        email = f"test_user_{uuid.uuid4().hex[:6]}@sigma.co.id"
        r = admin.post(f"{API}/users", json={
            "name": "TEST User", "email": email, "password": "TestPass@123",
            "role_id": role_ids["Viewer"],
        }, timeout=15)
        assert r.status_code == 201, r.text
        uid = r.json()["id"]
        assert r.json()["role_name"] == "Viewer"
        assert r.json()["is_active"] is True

        # duplicate email → 422
        r2 = admin.post(f"{API}/users", json={
            "name": "TEST User2", "email": email, "password": "TestPass@123",
            "role_id": role_ids["Viewer"],
        }, timeout=15)
        assert r2.status_code == 422

        # unknown role → 422
        r3 = admin.post(f"{API}/users", json={
            "name": "TEST User3", "email": f"other_{uuid.uuid4().hex[:6]}@x.com",
            "password": "TestPass@123", "role_id": "nonexistent-role-id",
        }, timeout=15)
        assert r3.status_code == 422

        # login as new user works
        us = requests.Session()
        lr = us.post(f"{API}/auth/login", json={"email": email, "password": "TestPass@123"}, timeout=15)
        assert lr.status_code == 200
        assert lr.json()["role_name"] == "Viewer"

        # reset password
        rp = admin.put(f"{API}/users/{uid}/password", json={"password": "NewPass@2026"}, timeout=15)
        assert rp.status_code == 200
        # old password fails
        assert requests.post(f"{API}/auth/login",
                             json={"email": email, "password": "TestPass@123"}, timeout=15).status_code == 401
        # new password works
        us2 = requests.Session()
        assert us2.post(f"{API}/auth/login", json={"email": email, "password": "NewPass@2026"},
                        timeout=15).status_code == 200

        # deactivate user
        ds = admin.put(f"{API}/users/{uid}/status", json={"is_active": False}, timeout=15)
        assert ds.status_code == 200
        assert ds.json()["is_active"] is False
        # login blocked
        lb = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": "NewPass@2026"}, timeout=15)
        assert lb.status_code == 403
        assert "nonaktifkan" in lb.json().get("detail", "").lower()

        # existing session /me also 403
        me = us2.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 403

        # reactivate
        rs = admin.put(f"{API}/users/{uid}/status", json={"is_active": True}, timeout=15)
        assert rs.status_code == 200 and rs.json()["is_active"] is True
        # login works again
        assert requests.post(f"{API}/auth/login",
                             json={"email": email, "password": "NewPass@2026"},
                             timeout=15).status_code == 200

        # update user (change role)
        up = admin.put(f"{API}/users/{uid}",
                       json={"name": "TEST User Upd", "role_id": role_ids["Staff"]}, timeout=15)
        assert up.status_code == 200 and up.json()["role_name"] == "Staff"

        # delete
        d = admin.delete(f"{API}/users/{uid}", timeout=15)
        assert d.status_code == 200

        # verify gone
        users = admin.get(f"{API}/users", timeout=15).json()
        assert not any(u["id"] == uid for u in users)

    def test_self_protection_rules(self, admin, role_ids):
        me = admin.get(f"{API}/auth/me", timeout=15).json()
        my_id = me["id"]

        # self-delete → 422
        r = admin.delete(f"{API}/users/{my_id}", timeout=15)
        assert r.status_code == 422

        # self-deactivate → 422
        r2 = admin.put(f"{API}/users/{my_id}/status", json={"is_active": False}, timeout=15)
        assert r2.status_code == 422

        # change own role → 422
        r3 = admin.put(f"{API}/users/{my_id}",
                       json={"name": me["name"], "role_id": role_ids["Staff"]}, timeout=15)
        assert r3.status_code == 422

        # updating own name with same role → OK
        r4 = admin.put(f"{API}/users/{my_id}",
                       json={"name": me["name"], "role_id": role_ids["Administrator"]}, timeout=15)
        assert r4.status_code == 200


# ---------- Live role revocation ----------
class TestLiveRoleRevocation:
    def test_role_change_takes_effect_without_relogin(self, admin, role_ids):
        # Create a fresh user with Staff role
        email = f"test_rev_{uuid.uuid4().hex[:6]}@sigma.co.id"
        cr = admin.post(f"{API}/users", json={
            "name": "TEST Revocation", "email": email, "password": "RevPass@2026",
            "role_id": role_ids["Staff"],
        }, timeout=15)
        assert cr.status_code == 201
        uid = cr.json()["id"]

        us = requests.Session()
        lr = us.post(f"{API}/auth/login", json={"email": email, "password": "RevPass@2026"}, timeout=15)
        assert lr.status_code == 200
        # As Staff: can POST asset
        kode = f"TEST-REV-{uuid.uuid4().hex[:6]}"
        r1 = us.post(f"{API}/assets", json={"kode_aset": kode, "nama_aset": "TEST Rev Asset"}, timeout=15)
        assert r1.status_code == 201
        created_id = r1.json()["id"]

        # Admin changes their role to Viewer
        up = admin.put(f"{API}/users/{uid}",
                       json={"name": "TEST Revocation", "role_id": role_ids["Viewer"]}, timeout=15)
        assert up.status_code == 200

        # Same session (no re-login) should now be denied 403 on POST /assets
        r2 = us.post(f"{API}/assets",
                     json={"kode_aset": f"TEST-REV2-{uuid.uuid4().hex[:6]}", "nama_aset": "denied"}, timeout=15)
        assert r2.status_code == 403

        # But /auth/me still 200 with new role_name
        me = us.get(f"{API}/auth/me", timeout=15).json()
        assert me["role_name"] == "Viewer"

        # cleanup
        admin.delete(f"{API}/assets/{created_id}", timeout=15)
        admin.delete(f"{API}/users/{uid}", timeout=15)
