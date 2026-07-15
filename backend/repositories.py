import uuid
from typing import Optional
from core import db, now_iso


class BaseRepository:
    collection_name: str

    @property
    def col(self):
        return db[self.collection_name]

    async def find_by_id(self, doc_id: str) -> Optional[dict]:
        return await self.col.find_one({"_id": doc_id})

    async def insert(self, data: dict) -> dict:
        data["_id"] = str(uuid.uuid4())
        data["created_at"] = now_iso()
        data["updated_at"] = now_iso()
        await self.col.insert_one(data)
        return data

    async def update(self, doc_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = now_iso()
        await self.col.update_one({"_id": doc_id}, {"$set": data})
        return await self.find_by_id(doc_id)

    async def delete(self, doc_id: str) -> bool:
        result = await self.col.delete_one({"_id": doc_id})
        return result.deleted_count > 0

    async def count(self, query: dict = None) -> int:
        return await self.col.count_documents(query or {})

    async def find_many(self, query: dict = None, sort=None, skip: int = 0, limit: int = 0) -> list:
        cursor = self.col.find(query or {})
        if sort:
            cursor = cursor.sort(sort)
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=limit or 1000)


class UserRepository(BaseRepository):
    collection_name = "users"

    async def find_by_email(self, email: str) -> Optional[dict]:
        return await self.col.find_one({"email": email.lower()})


class OfficeRepository(BaseRepository):
    collection_name = "offices"


class RoomRepository(BaseRepository):
    collection_name = "rooms"

    async def delete_by_office(self, office_id: str):
        await self.col.delete_many({"office_id": office_id})


class AssetRepository(BaseRepository):
    collection_name = "assets"

    async def find_by_kode(self, kode: str) -> Optional[dict]:
        return await self.col.find_one({"kode_aset": kode})

    async def unset_office(self, office_id: str):
        await self.col.update_many(
            {"current_office_id": office_id},
            {"$set": {"current_office_id": None, "current_room_id": None, "updated_at": now_iso()}},
        )

    async def unset_room(self, room_id: str):
        await self.col.update_many(
            {"current_room_id": room_id},
            {"$set": {"current_room_id": None, "updated_at": now_iso()}},
        )


class AssetLogRepository(BaseRepository):
    collection_name = "asset_logs"

    async def delete_by_asset(self, asset_id: str):
        await self.col.delete_many({"asset_id": asset_id})


user_repo = UserRepository()
office_repo = OfficeRepository()
room_repo = RoomRepository()
asset_repo = AssetRepository()
asset_log_repo = AssetLogRepository()
