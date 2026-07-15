from fastapi import APIRouter, Depends, HTTPException, Response, Request, Query
from core import (
    get_current_user, hash_password, verify_password,
    create_access_token, create_refresh_token, set_auth_cookies, now_iso,
)
from repositories import user_repo
from schemas import RegisterIn, LoginIn, UserOut, OfficeIn, RoomIn, AssetIn, MoveIn
from services import office_service, room_service, asset_service, stats_service

auth_router = APIRouter(prefix="/auth", tags=["auth"])
api_router = APIRouter(tags=["sigma"])


def _user_out(user: dict) -> dict:
    return {"id": user.get("id") or user.get("_id"), "name": user["name"], "email": user["email"], "role": user.get("role", "user")}


@auth_router.post("/register", response_model=UserOut)
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await user_repo.find_by_email(email):
        raise HTTPException(422, "Email sudah terdaftar")
    user = await user_repo.insert({
        "name": body.name, "email": email,
        "password_hash": hash_password(body.password), "role": "user",
    })
    set_auth_cookies(response, create_access_token(user["_id"], email), create_refresh_token(user["_id"]))
    return _user_out(user)


@auth_router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response):
    user = await user_repo.find_by_email(body.email.lower())
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    set_auth_cookies(response, create_access_token(user["_id"], user["email"]), create_refresh_token(user["_id"]))
    return _user_out(user)


@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Berhasil logout"}


@auth_router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return _user_out(current_user)


# ---------- Offices ----------
@api_router.get("/offices")
async def list_offices(current_user: dict = Depends(get_current_user)):
    return await office_service.list_all()


@api_router.post("/offices", status_code=201)
async def create_office(body: OfficeIn, current_user: dict = Depends(get_current_user)):
    return await office_service.create(body)


@api_router.put("/offices/{office_id}")
async def update_office(office_id: str, body: OfficeIn, current_user: dict = Depends(get_current_user)):
    return await office_service.update(office_id, body)


@api_router.delete("/offices/{office_id}")
async def delete_office(office_id: str, current_user: dict = Depends(get_current_user)):
    await office_service.delete(office_id)
    return {"message": "Kantor berhasil dihapus"}


# ---------- Rooms ----------
@api_router.get("/rooms")
async def list_rooms(office_id: str = Query(default=None), current_user: dict = Depends(get_current_user)):
    return await room_service.list_all(office_id)


@api_router.post("/rooms", status_code=201)
async def create_room(body: RoomIn, current_user: dict = Depends(get_current_user)):
    return await room_service.create(body)


@api_router.put("/rooms/{room_id}")
async def update_room(room_id: str, body: RoomIn, current_user: dict = Depends(get_current_user)):
    return await room_service.update(room_id, body)


@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: dict = Depends(get_current_user)):
    await room_service.delete(room_id)
    return {"message": "Ruangan berhasil dihapus"}


# ---------- Assets ----------
@api_router.get("/assets")
async def list_assets(
    search: str = Query(default=None),
    office_id: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    return await asset_service.list_paginated(search, office_id, page, limit)


@api_router.post("/assets", status_code=201)
async def create_asset(body: AssetIn, current_user: dict = Depends(get_current_user)):
    return await asset_service.create(body)


@api_router.get("/assets/{asset_id}")
async def get_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    return await asset_service.get_detail(asset_id)


@api_router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, body: AssetIn, current_user: dict = Depends(get_current_user)):
    return await asset_service.update(asset_id, body)


@api_router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    await asset_service.delete(asset_id)
    return {"message": "Aset berhasil dihapus"}


@api_router.get("/assets/{asset_id}/history")
async def asset_history(
    asset_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    date_from: str = Query(default=None),
    date_to: str = Query(default=None),
    office_id: str = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    return await asset_service.history(asset_id, page, limit, date_from, date_to, office_id)


@api_router.post("/assets/{asset_id}/move")
async def move_asset(asset_id: str, body: MoveIn, current_user: dict = Depends(get_current_user)):
    return await asset_service.move(asset_id, body, current_user["name"])


@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    return await stats_service.get_stats()
