import math
from fastapi import HTTPException
from core import now_iso
from repositories import office_repo, room_repo, asset_repo, asset_log_repo, asset_repair_repo
from schemas import MoveIn, AssetIn, OfficeIn, RoomIn, RepairIn


def _paginate(total: int, page: int, limit: int) -> dict:
    return {"total": total, "page": page, "pages": max(1, math.ceil(total / limit)), "limit": limit}


def _doc_out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    return doc


class OfficeService:
    async def list_all(self) -> list:
        offices = await office_repo.find_many(sort=[("nama_kantor", 1)])
        result = []
        for o in offices:
            out = _doc_out(o)
            out["jumlah_ruangan"] = await room_repo.count({"office_id": o["_id"]})
            out["jumlah_aset"] = await asset_repo.count({"current_office_id": o["_id"]})
            result.append(out)
        return result

    async def create(self, data: OfficeIn) -> dict:
        return _doc_out(await office_repo.insert(data.model_dump()))

    async def update(self, office_id: str, data: OfficeIn) -> dict:
        if not await office_repo.find_by_id(office_id):
            raise HTTPException(404, "Kantor tidak ditemukan")
        return _doc_out(await office_repo.update(office_id, data.model_dump()))

    async def delete(self, office_id: str):
        if not await office_repo.find_by_id(office_id):
            raise HTTPException(404, "Kantor tidak ditemukan")
        rooms = await room_repo.find_many({"office_id": office_id})
        for r in rooms:
            await asset_repo.unset_room(r["_id"])
        await room_repo.delete_by_office(office_id)
        await asset_repo.unset_office(office_id)
        await office_repo.delete(office_id)


class RoomService:
    async def list_all(self, office_id: str = None) -> list:
        query = {"office_id": office_id} if office_id else {}
        rooms = await room_repo.find_many(query, sort=[("nama_ruangan", 1)])
        offices = {o["_id"]: o["nama_kantor"] for o in await office_repo.find_many()}
        result = []
        for r in rooms:
            out = _doc_out(r)
            out["nama_kantor"] = offices.get(r.get("office_id"))
            out["jumlah_aset"] = await asset_repo.count({"current_room_id": r["_id"]})
            result.append(out)
        return result

    async def create(self, data: RoomIn) -> dict:
        if not await office_repo.find_by_id(data.office_id):
            raise HTTPException(422, "Kantor tidak ditemukan")
        return _doc_out(await room_repo.insert(data.model_dump()))

    async def update(self, room_id: str, data: RoomIn) -> dict:
        if not await room_repo.find_by_id(room_id):
            raise HTTPException(404, "Ruangan tidak ditemukan")
        if not await office_repo.find_by_id(data.office_id):
            raise HTTPException(422, "Kantor tidak ditemukan")
        return _doc_out(await room_repo.update(room_id, data.model_dump()))

    async def delete(self, room_id: str):
        if not await room_repo.find_by_id(room_id):
            raise HTTPException(404, "Ruangan tidak ditemukan")
        await asset_repo.unset_room(room_id)
        await room_repo.delete(room_id)


class AssetService:
    async def _enrich(self, asset: dict, offices: dict = None, rooms: dict = None) -> dict:
        if offices is None:
            offices = {o["_id"]: o["nama_kantor"] for o in await office_repo.find_many()}
        if rooms is None:
            rooms = {r["_id"]: r["nama_ruangan"] for r in await room_repo.find_many()}
        out = _doc_out(asset)
        out["current_office_name"] = offices.get(asset.get("current_office_id"))
        out["current_room_name"] = rooms.get(asset.get("current_room_id"))
        out["total_moves"] = await asset_log_repo.count({"asset_id": asset["_id"]})
        out["total_repairs"] = await asset_repair_repo.count({"asset_id": asset["_id"]})
        out["in_repair"] = await asset_repair_repo.count({"asset_id": asset["_id"], "status": "Dalam Perbaikan"}) > 0
        return out

    async def list_paginated(self, search: str = None, office_id: str = None, page: int = 1, limit: int = 10) -> dict:
        query = {}
        if search:
            query["$or"] = [
                {"nama_aset": {"$regex": search, "$options": "i"}},
                {"kode_aset": {"$regex": search, "$options": "i"}},
            ]
        if office_id:
            query["current_office_id"] = office_id
        total = await asset_repo.count(query)
        docs = await asset_repo.find_many(query, sort=[("created_at", -1)], skip=(page - 1) * limit, limit=limit)
        offices = {o["_id"]: o["nama_kantor"] for o in await office_repo.find_many()}
        rooms = {r["_id"]: r["nama_ruangan"] for r in await room_repo.find_many()}
        items = [await self._enrich(d, offices, rooms) for d in docs]
        return {"items": items, **_paginate(total, page, limit)}

    async def get_detail(self, asset_id: str) -> dict:
        asset = await asset_repo.find_by_id(asset_id)
        if not asset:
            raise HTTPException(404, "Aset tidak ditemukan")
        return await self._enrich(asset)

    async def _validate_location(self, office_id: str, room_id: str):
        office = await office_repo.find_by_id(office_id)
        if not office:
            raise HTTPException(422, "Kantor tidak ditemukan")
        room = await room_repo.find_by_id(room_id)
        if not room:
            raise HTTPException(422, "Ruangan tidak ditemukan")
        if room.get("office_id") != office_id:
            raise HTTPException(422, "Ruangan tidak berada pada kantor yang dipilih")
        return office, room

    async def create(self, data: AssetIn) -> dict:
        if await asset_repo.find_by_kode(data.kode_aset):
            raise HTTPException(422, "Kode aset sudah digunakan")
        payload = data.model_dump()
        office_id, room_id = payload.pop("office_id"), payload.pop("room_id")
        if office_id and room_id:
            await self._validate_location(office_id, room_id)
        elif office_id:
            if not await office_repo.find_by_id(office_id):
                raise HTTPException(422, "Kantor tidak ditemukan")
            room_id = None
        else:
            office_id = room_id = None
        payload["current_office_id"] = office_id
        payload["current_room_id"] = room_id
        payload["last_moved_at"] = None
        return await self._enrich(await asset_repo.insert(payload))

    async def update(self, asset_id: str, data: AssetIn) -> dict:
        asset = await asset_repo.find_by_id(asset_id)
        if not asset:
            raise HTTPException(404, "Aset tidak ditemukan")
        existing = await asset_repo.find_by_kode(data.kode_aset)
        if existing and existing["_id"] != asset_id:
            raise HTTPException(422, "Kode aset sudah digunakan")
        payload = data.model_dump(exclude={"office_id", "room_id"})
        updated = await asset_repo.update(asset_id, payload)
        return await self._enrich(updated)

    async def delete(self, asset_id: str):
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        await asset_log_repo.delete_by_asset(asset_id)
        await asset_repair_repo.delete_by_asset(asset_id)
        await asset_repo.delete(asset_id)

    async def move(self, asset_id: str, data: MoveIn, moved_by: str) -> dict:
        asset = await asset_repo.find_by_id(asset_id)
        if not asset:
            raise HTTPException(404, "Aset tidak ditemukan")
        office, room = await self._validate_location(data.office_id, data.room_id)
        if asset.get("current_office_id") == data.office_id and asset.get("current_room_id") == data.room_id:
            raise HTTPException(422, "Aset sudah berada di lokasi tersebut")

        offices = {o["_id"]: o["nama_kantor"] for o in await office_repo.find_many()}
        rooms = {r["_id"]: r["nama_ruangan"] for r in await room_repo.find_many()}
        moved_at = now_iso()
        log = {
            "asset_id": asset_id,
            "from_office_id": asset.get("current_office_id"),
            "from_office_name": offices.get(asset.get("current_office_id")),
            "from_room_id": asset.get("current_room_id"),
            "from_room_name": rooms.get(asset.get("current_room_id")),
            "to_office_id": data.office_id,
            "to_office_name": office["nama_kantor"],
            "to_room_id": data.room_id,
            "to_room_name": room["nama_ruangan"],
            "moved_by": moved_by,
            "notes": data.notes,
            "moved_at": moved_at,
        }
        inserted_log = await asset_log_repo.insert(log)
        try:
            await asset_repo.update(asset_id, {
                "current_office_id": data.office_id,
                "current_room_id": data.room_id,
                "last_moved_at": moved_at,
            })
        except Exception:
            await asset_log_repo.delete(inserted_log["_id"])
            raise HTTPException(500, "Gagal memindahkan aset, perubahan dibatalkan")
        updated = await asset_repo.find_by_id(asset_id)
        return {"asset": await self._enrich(updated), "log": _doc_out(inserted_log)}

    async def history(self, asset_id: str, page: int = 1, limit: int = 10,
                      date_from: str = None, date_to: str = None, office_id: str = None) -> dict:
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        query = {"asset_id": asset_id}
        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query["$gte"] = date_from
            if date_to:
                date_query["$lte"] = date_to + "T23:59:59.999999+00:00"
            query["moved_at"] = date_query
        if office_id:
            query["$or"] = [{"to_office_id": office_id}, {"from_office_id": office_id}]
        total = await asset_log_repo.count(query)
        docs = await asset_log_repo.find_many(query, sort=[("moved_at", -1)], skip=(page - 1) * limit, limit=limit)
        return {"items": [_doc_out(d) for d in docs], **_paginate(total, page, limit)}

    async def all_history_rows(self, asset_id: str) -> list:
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        docs = await asset_log_repo.find_many({"asset_id": asset_id}, sort=[("moved_at", -1)], limit=10000)
        return [_doc_out(d) for d in docs]

    async def export_rows(self) -> list:
        docs = await asset_repo.find_many({}, sort=[("kode_aset", 1)], limit=10000)
        offices = {o["_id"]: o["nama_kantor"] for o in await office_repo.find_many()}
        rooms = {r["_id"]: r["nama_ruangan"] for r in await room_repo.find_many()}
        rows = []
        for d in docs:
            out = _doc_out(d)
            out["current_office_name"] = offices.get(d.get("current_office_id"))
            out["current_room_name"] = rooms.get(d.get("current_room_id"))
            rows.append(out)
        return rows

    async def import_rows(self, rows: list) -> dict:
        offices = {o["nama_kantor"].strip().lower(): o["_id"] for o in await office_repo.find_many()}
        all_rooms = await room_repo.find_many()
        imported, skipped, errors = 0, 0, []
        for idx, row in enumerate(rows, start=2):
            kode = str(row.get("kode_aset") or "").strip()
            nama = str(row.get("nama_aset") or "").strip()
            if not kode or not nama:
                errors.append({"row": idx, "message": "kode_aset dan nama_aset wajib diisi"})
                continue
            if await asset_repo.find_by_kode(kode):
                skipped += 1
                continue
            status = str(row.get("status") or "").strip().title() or None
            if status and status not in ("Lunas", "Penyusutan"):
                errors.append({"row": idx, "message": f"Status '{status}' tidak valid (Lunas/Penyusutan)"})
                continue
            nilai = row.get("nilai_pembelian")
            try:
                nilai = float(str(nilai).replace(",", "").strip()) if nilai not in (None, "") else None
            except ValueError:
                errors.append({"row": idx, "message": "nilai_pembelian bukan angka valid"})
                continue
            office_id = offices.get(str(row.get("nama_kantor") or "").strip().lower())
            room_id = None
            if office_id:
                room_name = str(row.get("nama_ruangan") or "").strip().lower()
                if room_name:
                    room_id = next((r["_id"] for r in all_rooms
                                    if r["office_id"] == office_id and r["nama_ruangan"].strip().lower() == room_name), None)
            tanggal = row.get("tanggal_pembelian")
            tanggal = str(tanggal)[:10] if tanggal not in (None, "") else None
            await asset_repo.insert({
                "kode_aset": kode, "nama_aset": nama,
                "jenis_inventaris": str(row.get("jenis_inventaris") or "").strip() or None,
                "golongan": str(row.get("golongan") or "").strip() or None,
                "tanggal_pembelian": tanggal, "nilai_pembelian": nilai, "status": status,
                "current_office_id": office_id, "current_room_id": room_id, "last_moved_at": None,
            })
            imported += 1
        return {"total_rows": len(rows), "imported": imported, "skipped": skipped, "errors": errors}


class RepairService:
    async def list_paginated(self, asset_id: str, page: int = 1, limit: int = 10) -> dict:
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        query = {"asset_id": asset_id}
        total = await asset_repair_repo.count(query)
        docs = await asset_repair_repo.find_many(query, sort=[("tanggal_perbaikan", -1)], skip=(page - 1) * limit, limit=limit)
        return {"items": [_doc_out(d) for d in docs], **_paginate(total, page, limit)}

    async def all_rows(self, asset_id: str) -> list:
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        docs = await asset_repair_repo.find_many({"asset_id": asset_id}, sort=[("tanggal_perbaikan", -1)], limit=10000)
        return [_doc_out(d) for d in docs]

    async def create(self, asset_id: str, data: RepairIn, created_by: str) -> dict:
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        payload = data.model_dump()
        payload["asset_id"] = asset_id
        payload["created_by"] = created_by
        return _doc_out(await asset_repair_repo.insert(payload))

    async def update(self, repair_id: str, data: RepairIn) -> dict:
        if not await asset_repair_repo.find_by_id(repair_id):
            raise HTTPException(404, "Riwayat perbaikan tidak ditemukan")
        return _doc_out(await asset_repair_repo.update(repair_id, data.model_dump()))

    async def delete(self, repair_id: str):
        if not await asset_repair_repo.find_by_id(repair_id):
            raise HTTPException(404, "Riwayat perbaikan tidak ditemukan")
        await asset_repair_repo.delete(repair_id)


class StatsService:
    async def get_stats(self) -> dict:
        return {
            "total_assets": await asset_repo.count(),
            "total_offices": await office_repo.count(),
            "total_rooms": await room_repo.count(),
            "total_moves": await asset_log_repo.count(),
        }


office_service = OfficeService()
room_service = RoomService()
asset_service = AssetService()
repair_service = RepairService()
stats_service = StatsService()
