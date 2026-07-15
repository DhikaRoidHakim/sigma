"""SIGMA backend API regression tests.

Covers: auth, offices CRUD, rooms CRUD, assets CRUD, move validations,
history filters, delete-office preserves history, stats, auth protection.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sigma-asset-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@sigma.co.id"
ADMIN_PASSWORD = "Sigma@2026"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def seed_ids(admin_session):
    """Return dict with a seed office id, room id and asset id."""
    offices = admin_session.get(f"{API}/offices", timeout=15).json()
    assert len(offices) >= 1
    office = next((o for o in offices if o["nama_kantor"] == "Kantor Pusat Jakarta"), offices[0])
    rooms = admin_session.get(f"{API}/rooms", params={"office_id": office["id"]}, timeout=15).json()
    assert len(rooms) >= 1
    assets = admin_session.get(f"{API}/assets", params={"limit": 5}, timeout=15).json()["items"]
    assert len(assets) >= 1
    return {"office_id": office["id"], "office_name": office["nama_kantor"],
            "room_id": rooms[0]["id"], "asset_id": assets[0]["id"], "asset_kode": assets[0]["kode_aset"]}


# ---------- auth ----------
class TestAuth:
    def test_login_success(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "access_token" in s.cookies

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nobody@example.com", "password": "whatever"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_authenticated(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_assets_unauthenticated(self):
        r = requests.get(f"{API}/assets", timeout=15)
        assert r.status_code == 401

    def test_logout(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        # cookie should be cleared server-side
        r2 = s.get(f"{API}/auth/me", timeout=15)
        assert r2.status_code == 401


# ---------- stats ----------
class TestStats:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_assets", "total_offices", "total_rooms", "total_moves"):
            assert k in d and isinstance(d[k], int)
        assert d["total_offices"] >= 3
        assert d["total_assets"] >= 10


# ---------- assets list ----------
class TestAssetList:
    def test_list_default(self, admin_session):
        r = admin_session.get(f"{API}/assets", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d and "page" in d and "pages" in d
        assert d["page"] == 1

    def test_search(self, admin_session):
        r = admin_session.get(f"{API}/assets", params={"search": "Laptop"}, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("Laptop" in i["nama_aset"] for i in items)

    def test_filter_by_office(self, admin_session, seed_ids):
        r = admin_session.get(f"{API}/assets", params={"office_id": seed_ids["office_id"]}, timeout=15)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["current_office_id"] == seed_ids["office_id"]

    def test_pagination(self, admin_session):
        r = admin_session.get(f"{API}/assets", params={"page": 1, "limit": 2}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["limit"] == 2
        assert len(d["items"]) <= 2

    def test_get_detail(self, admin_session, seed_ids):
        r = admin_session.get(f"{API}/assets/{seed_ids['asset_id']}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == seed_ids["asset_id"]

    def test_get_detail_404(self, admin_session):
        r = admin_session.get(f"{API}/assets/does-not-exist", timeout=15)
        assert r.status_code == 404


# ---------- Move validations ----------
class TestMoveValidation:
    def test_move_office_not_found(self, admin_session, seed_ids):
        r = admin_session.post(
            f"{API}/assets/{seed_ids['asset_id']}/move",
            json={"office_id": "bogus-office", "room_id": seed_ids["room_id"]},
            timeout=15,
        )
        assert r.status_code == 422

    def test_move_room_not_found(self, admin_session, seed_ids):
        r = admin_session.post(
            f"{API}/assets/{seed_ids['asset_id']}/move",
            json={"office_id": seed_ids["office_id"], "room_id": "bogus-room"},
            timeout=15,
        )
        assert r.status_code == 422

    def test_move_room_office_mismatch(self, admin_session, seed_ids):
        # find a room in a different office
        offices = admin_session.get(f"{API}/offices").json()
        other = next((o for o in offices if o["id"] != seed_ids["office_id"]), None)
        assert other
        other_rooms = admin_session.get(f"{API}/rooms", params={"office_id": other["id"]}).json()
        assert other_rooms
        r = admin_session.post(
            f"{API}/assets/{seed_ids['asset_id']}/move",
            json={"office_id": seed_ids["office_id"], "room_id": other_rooms[0]["id"]},
            timeout=15,
        )
        assert r.status_code == 422

    def test_move_asset_not_found(self, admin_session, seed_ids):
        r = admin_session.post(
            f"{API}/assets/bogus-asset/move",
            json={"office_id": seed_ids["office_id"], "room_id": seed_ids["room_id"]},
            timeout=15,
        )
        assert r.status_code == 404

    def test_notes_max_length(self, admin_session, seed_ids):
        r = admin_session.post(
            f"{API}/assets/{seed_ids['asset_id']}/move",
            json={"office_id": seed_ids["office_id"], "room_id": seed_ids["room_id"], "notes": "x" * 501},
            timeout=15,
        )
        assert r.status_code == 422


# ---------- Valid move + history ----------
class TestMoveAndHistory:
    def test_valid_move_then_same_location_422(self, admin_session):
        # Pick asset AST-005 to avoid touching AST-001 (already used by main agent)
        assets = admin_session.get(f"{API}/assets", params={"search": "AST-005"}).json()["items"]
        assert assets, "AST-005 not found"
        asset = assets[0]
        offices = admin_session.get(f"{API}/offices").json()
        # pick a room in DIFFERENT office from current
        target_office = next(o for o in offices if o["id"] != asset["current_office_id"])
        target_rooms = admin_session.get(f"{API}/rooms", params={"office_id": target_office["id"]}).json()
        target_room = target_rooms[0]

        move_body = {"office_id": target_office["id"], "room_id": target_room["id"],
                     "notes": "TEST_move regression check"}
        r = admin_session.post(f"{API}/assets/{asset['id']}/move", json=move_body, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["asset"]["current_office_id"] == target_office["id"]
        assert data["asset"]["current_room_id"] == target_room["id"]
        assert data["asset"]["last_moved_at"] is not None
        log = data["log"]
        assert log["to_office_name"] == target_office["nama_kantor"]
        assert log["to_room_name"] == target_room["nama_ruangan"]
        assert log["moved_by"] == "Administrator"
        assert log["notes"] == "TEST_move regression check"

        # Same location → 422
        r2 = admin_session.post(f"{API}/assets/{asset['id']}/move", json=move_body, timeout=15)
        assert r2.status_code == 422

        # History pagination
        h = admin_session.get(f"{API}/assets/{asset['id']}/history", params={"page": 1, "limit": 5}).json()
        assert h["total"] >= 1
        assert h["items"][0]["to_office_name"] == target_office["nama_kantor"]

    def test_history_office_filter(self, admin_session):
        # Use AST-001 which has multiple logs
        assets = admin_session.get(f"{API}/assets", params={"search": "AST-001"}).json()["items"]
        asset = assets[0]
        offices = admin_session.get(f"{API}/offices").json()
        r = admin_session.get(f"{API}/assets/{asset['id']}/history",
                              params={"office_id": offices[0]["id"]}).json()
        for it in r["items"]:
            assert it.get("from_office_id") == offices[0]["id"] or it.get("to_office_id") == offices[0]["id"]

    def test_history_date_filter(self, admin_session):
        assets = admin_session.get(f"{API}/assets", params={"search": "AST-001"}).json()["items"]
        asset = assets[0]
        # future date range should return empty
        r = admin_session.get(f"{API}/assets/{asset['id']}/history",
                              params={"date_from": "2099-01-01", "date_to": "2099-12-31"}).json()
        assert r["total"] == 0


# ---------- Offices & Rooms CRUD ----------
class TestOfficesRoomsCrud:
    def test_office_crud(self, admin_session):
        # create
        name = f"TEST_Office_{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{API}/offices", json={"nama_kantor": name})
        assert r.status_code == 201
        oid = r.json()["id"]
        # update
        new_name = name + "_upd"
        r2 = admin_session.put(f"{API}/offices/{oid}", json={"nama_kantor": new_name})
        assert r2.status_code == 200 and r2.json()["nama_kantor"] == new_name
        # verify persisted via list
        offices = admin_session.get(f"{API}/offices").json()
        assert any(o["id"] == oid and o["nama_kantor"] == new_name for o in offices)
        # delete
        rd = admin_session.delete(f"{API}/offices/{oid}")
        assert rd.status_code == 200
        offices = admin_session.get(f"{API}/offices").json()
        assert not any(o["id"] == oid for o in offices)

    def test_room_crud_and_office_validation(self, admin_session):
        # create parent office
        office = admin_session.post(f"{API}/offices", json={"nama_kantor": f"TEST_ParentOffice_{uuid.uuid4().hex[:6]}"}).json()
        # create room with bad office → 422
        r = admin_session.post(f"{API}/rooms", json={"office_id": "bogus", "nama_ruangan": "TEST_R"})
        assert r.status_code == 422
        # valid room
        r2 = admin_session.post(f"{API}/rooms", json={"office_id": office["id"], "nama_ruangan": "TEST_Room"})
        assert r2.status_code == 201
        rid = r2.json()["id"]
        # update
        r3 = admin_session.put(f"{API}/rooms/{rid}", json={"office_id": office["id"], "nama_ruangan": "TEST_Room_upd"})
        assert r3.status_code == 200
        # delete room
        r4 = admin_session.delete(f"{API}/rooms/{rid}")
        assert r4.status_code == 200
        # cleanup office
        admin_session.delete(f"{API}/offices/{office['id']}")


# ---------- Delete office preserves history ----------
class TestDeleteOfficePreservesHistory:
    def test_delete_office_history_preserved(self, admin_session):
        # 1. Create temp office + room
        office = admin_session.post(f"{API}/offices", json={"nama_kantor": f"TEST_TmpOffice_{uuid.uuid4().hex[:6]}"}).json()
        room = admin_session.post(f"{API}/rooms", json={"office_id": office["id"], "nama_ruangan": "TEST_TmpRoom"}).json()

        # 2. Create temp asset placed in that office/room
        asset = admin_session.post(
            f"{API}/assets",
            json={"kode_aset": f"TEST-{uuid.uuid4().hex[:6]}", "nama_aset": "TEST Asset",
                  "office_id": office["id"], "room_id": room["id"]},
        ).json()

        # 3. Move it to another (seed) office to create a log entry with from_office_name set
        offices = admin_session.get(f"{API}/offices").json()
        seed_office = next(o for o in offices if o["id"] != office["id"] and not o["nama_kantor"].startswith("TEST_"))
        seed_rooms = admin_session.get(f"{API}/rooms", params={"office_id": seed_office["id"]}).json()
        seed_room = seed_rooms[0]
        move = admin_session.post(
            f"{API}/assets/{asset['id']}/move",
            json={"office_id": seed_office["id"], "room_id": seed_room["id"], "notes": "TEST_prep"},
        )
        assert move.status_code == 200

        # 4. Move back INTO the temp office (create another log)
        move2 = admin_session.post(
            f"{API}/assets/{asset['id']}/move",
            json={"office_id": office["id"], "room_id": room["id"], "notes": "TEST_back"},
        )
        assert move2.status_code == 200

        # 5. Delete the temp office
        rd = admin_session.delete(f"{API}/offices/{office['id']}")
        assert rd.status_code == 200

        # 6. Asset should still exist but be unplaced
        a = admin_session.get(f"{API}/assets/{asset['id']}").json()
        assert a["current_office_id"] is None
        assert a["current_room_id"] is None

        # 7. History still returns entries with the OLD names denormalized
        h = admin_session.get(f"{API}/assets/{asset['id']}/history").json()
        assert h["total"] >= 2
        tmp_office_name = office["nama_kantor"]
        found_from = any(it.get("from_office_name") == tmp_office_name for it in h["items"])
        found_to = any(it.get("to_office_name") == tmp_office_name for it in h["items"])
        assert found_from or found_to, "Denormalized office name lost after office deletion"

        # cleanup
        admin_session.delete(f"{API}/assets/{asset['id']}")


# ---------- Asset CRUD ----------
class TestAssetCrud:
    def test_asset_create_dup_kode(self, admin_session):
        payload = {"kode_aset": "AST-001", "nama_aset": "dup"}
        r = admin_session.post(f"{API}/assets", json=payload)
        assert r.status_code == 422

    def test_asset_create_update_delete(self, admin_session):
        kode = f"TEST-{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{API}/assets", json={"kode_aset": kode, "nama_aset": "TEST Asset New"})
        assert r.status_code == 201
        aid = r.json()["id"]
        # update
        r2 = admin_session.put(f"{API}/assets/{aid}", json={"kode_aset": kode, "nama_aset": "TEST Asset Updated"})
        assert r2.status_code == 200 and r2.json()["nama_aset"] == "TEST Asset Updated"
        # get to verify
        r3 = admin_session.get(f"{API}/assets/{aid}").json()
        assert r3["nama_aset"] == "TEST Asset Updated"
        # delete
        rd = admin_session.delete(f"{API}/assets/{aid}")
        assert rd.status_code == 200
        r4 = admin_session.get(f"{API}/assets/{aid}")
        assert r4.status_code == 404
