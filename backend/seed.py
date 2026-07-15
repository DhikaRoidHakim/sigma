import os
import uuid
from datetime import datetime, timezone, timedelta
from core import db, hash_password, verify_password, now_iso


async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"]
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "_id": str(uuid.uuid4()), "email": admin_email, "name": "Administrator",
            "password_hash": hash_password(admin_password), "role": "admin",
            "created_at": now_iso(), "updated_at": now_iso(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


async def seed_data():
    if await db.offices.count_documents({}) > 0:
        return

    def _id():
        return str(uuid.uuid4())

    ts = now_iso()
    offices = [
        {"_id": _id(), "nama_kantor": "Kantor Pusat Jakarta", "created_at": ts, "updated_at": ts},
        {"_id": _id(), "nama_kantor": "Kantor Cabang Bandung", "created_at": ts, "updated_at": ts},
        {"_id": _id(), "nama_kantor": "Kantor Cabang Surabaya", "created_at": ts, "updated_at": ts},
    ]
    await db.offices.insert_many(offices)

    room_names = {
        0: ["Ruang IT", "Ruang Keuangan", "Ruang Direksi", "Gudang Utama"],
        1: ["Ruang Operasional", "Ruang Meeting", "Gudang Cabang"],
        2: ["Ruang Administrasi", "Ruang Server", "Ruang Arsip"],
    }
    rooms = []
    for idx, names in room_names.items():
        for name in names:
            rooms.append({"_id": _id(), "office_id": offices[idx]["_id"], "nama_ruangan": name, "created_at": ts, "updated_at": ts})
    await db.rooms.insert_many(rooms)

    def room_of(office_idx, room_idx):
        return [r for r in rooms if r["office_id"] == offices[office_idx]["_id"]][room_idx]

    asset_defs = [
        ("AST-001", "Laptop Dell Latitude 5540", 0, 0),
        ("AST-002", "Printer HP LaserJet Pro M404", 0, 1),
        ("AST-003", "Proyektor Epson EB-X51", 0, 2),
        ("AST-004", "Server Rack Dell PowerEdge R750", 2, 1),
        ("AST-005", "Kursi Ergonomis Herman Miller", 0, 2),
        ("AST-006", "Monitor LG UltraWide 34\"", 1, 0),
        ("AST-007", "Mesin Fotokopi Canon iR2625", 1, 1),
        ("AST-008", "AC Daikin 2PK Inverter", 2, 0),
        ("AST-009", "Scanner Fujitsu fi-7160", 2, 2),
        ("AST-010", "UPS APC Smart-UPS 3000VA", 0, 3),
    ]
    assets = []
    for kode, nama, o_idx, r_idx in asset_defs:
        room = room_of(o_idx, r_idx)
        assets.append({
            "_id": _id(), "kode_aset": kode, "nama_aset": nama,
            "current_office_id": offices[o_idx]["_id"], "current_room_id": room["_id"],
            "last_moved_at": None, "created_at": ts, "updated_at": ts,
        })
    await db.assets.insert_many(assets)

    office_map = {o["_id"]: o["nama_kantor"] for o in offices}
    room_map = {r["_id"]: r["nama_ruangan"] for r in rooms}
    move_defs = [
        (0, (1, 0), (0, 0), 20, "Penempatan awal selesai, mutasi ke Ruang IT untuk instalasi software"),
        (0, (0, 3), (1, 0), 45, "Dipinjam sementara untuk kebutuhan operasional cabang"),
        (1, (0, 3), (0, 1), 30, "Mutasi dari Gudang Utama ke Ruang Keuangan"),
        (3, (0, 3), (2, 1), 15, "Relokasi server ke Ruang Server Surabaya"),
        (6, (2, 2), (1, 1), 10, "Mutasi ke Ruang Meeting Bandung"),
    ]
    logs = []
    for a_idx, (fo, fr), (to, tr), days_ago, note in move_defs:
        asset = assets[a_idx]
        from_room = room_of(fo, fr)
        to_room = room_of(to, tr)
        moved_at = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
        logs.append({
            "_id": _id(), "asset_id": asset["_id"],
            "from_office_id": offices[fo]["_id"], "from_office_name": office_map[offices[fo]["_id"]],
            "from_room_id": from_room["_id"], "from_room_name": room_map[from_room["_id"]],
            "to_office_id": offices[to]["_id"], "to_office_name": office_map[offices[to]["_id"]],
            "to_room_id": to_room["_id"], "to_room_name": room_map[to_room["_id"]],
            "moved_by": "Administrator", "notes": note, "moved_at": moved_at,
            "created_at": moved_at, "updated_at": moved_at,
        })
        await db.assets.update_one(
            {"_id": asset["_id"]},
            {"$set": {"current_office_id": offices[to]["_id"], "current_room_id": to_room["_id"], "last_moved_at": moved_at}},
        )
    await db.asset_logs.insert_many(logs)


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.assets.create_index("kode_aset", unique=True)
    await db.asset_logs.create_index([("asset_id", 1), ("moved_at", -1)])
    await db.rooms.create_index("office_id")
