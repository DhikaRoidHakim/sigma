from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str = "user"


class OfficeIn(BaseModel):
    nama_kantor: str = Field(min_length=2, max_length=150)


class OfficeOut(BaseModel):
    id: str
    nama_kantor: str
    jumlah_ruangan: int = 0
    jumlah_aset: int = 0
    created_at: str
    updated_at: str


class RoomIn(BaseModel):
    office_id: str
    nama_ruangan: str = Field(min_length=2, max_length=150)


class RoomOut(BaseModel):
    id: str
    office_id: Optional[str] = None
    nama_ruangan: str
    nama_kantor: Optional[str] = None
    jumlah_aset: int = 0
    created_at: str
    updated_at: str


class AssetIn(BaseModel):
    kode_aset: str = Field(min_length=2, max_length=50)
    nama_aset: str = Field(min_length=2, max_length=150)
    office_id: Optional[str] = None
    room_id: Optional[str] = None


class AssetOut(BaseModel):
    id: str
    kode_aset: str
    nama_aset: str
    current_office_id: Optional[str] = None
    current_room_id: Optional[str] = None
    current_office_name: Optional[str] = None
    current_room_name: Optional[str] = None
    last_moved_at: Optional[str] = None
    total_moves: int = 0
    created_at: str
    updated_at: str


class MoveIn(BaseModel):
    office_id: str
    room_id: str
    notes: Optional[str] = Field(default=None, max_length=500)


class AssetLogOut(BaseModel):
    id: str
    asset_id: str
    from_office_id: Optional[str] = None
    from_office_name: Optional[str] = None
    from_room_id: Optional[str] = None
    from_room_name: Optional[str] = None
    to_office_id: Optional[str] = None
    to_office_name: Optional[str] = None
    to_room_id: Optional[str] = None
    to_room_name: Optional[str] = None
    moved_by: str
    notes: Optional[str] = None
    moved_at: str


class Paginated(BaseModel):
    items: List
    total: int
    page: int
    pages: int
    limit: int


class StatsOut(BaseModel):
    total_assets: int
    total_offices: int
    total_rooms: int
    total_moves: int
