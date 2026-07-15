import math
from fastapi import HTTPException
from core import now_iso
from repositories import office_repo, room_repo, asset_repo, asset_log_repo
from schemas import MoveIn, AssetIn, OfficeIn, RoomIn


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
        updated = await asset_repo.update(asset_id, {"kode_aset": data.kode_aset, "nama_aset": data.nama_aset})
        return await self._enrich(updated)

    async def delete(self, asset_id: str):
        if not await asset_repo.find_by_id(asset_id):
            raise HTTPException(404, "Aset tidak ditemukan")
        await asset_log_repo.delete_by_asset(asset_id)
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
stats_service = StatsService()
