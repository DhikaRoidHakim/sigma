import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"

ALL_PERMISSIONS = [
    {"key": "assets.view", "label": "Lihat aset, riwayat & laporan", "group": "Aset"},
    {"key": "assets.manage", "label": "Tambah & edit aset", "group": "Aset"},
    {"key": "assets.delete", "label": "Hapus aset", "group": "Aset"},
    {"key": "assets.move", "label": "Mutasi aset", "group": "Aset"},
    {"key": "assets.import_export", "label": "Import & export inventaris", "group": "Aset"},
    {"key": "repairs.manage", "label": "Kelola riwayat perbaikan", "group": "Perbaikan"},
    {"key": "offices.manage", "label": "Kelola kantor", "group": "Master Data"},
    {"key": "rooms.manage", "label": "Kelola ruangan", "group": "Master Data"},
    {"key": "users.manage", "label": "Kelola user", "group": "Administrasi"},
    {"key": "roles.manage", "label": "Kelola role & izin", "group": "Administrasi"},
]
ALL_PERMISSION_KEYS = [p["key"] for p in ALL_PERMISSIONS]


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, access_token: str, refresh_token: str):
    response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan. Hubungi administrator.")
        role = await db.roles.find_one({"_id": user["role_id"]}) if user.get("role_id") else None
        user.pop("password_hash", None)
        user["id"] = user.pop("_id")
        user["role_name"] = role["name"] if role else None
        user["permissions"] = role["permissions"] if role else []
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_permission(*permissions: str):
    async def checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_perms = current_user.get("permissions", [])
        if not any(p in user_perms for p in permissions):
            raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk aksi ini")
        return current_user
    return checker


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
