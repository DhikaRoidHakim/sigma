from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import client
from routes import auth_router, api_router, public_router
from seed import seed_admin, seed_data, create_indexes

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("sigma")

app = FastAPI(title="SIGMA - Sistem Informasi Manajemen Aset")

root_router = APIRouter(prefix="/api")


@root_router.get("/")
async def root():
    return {"message": "SIGMA API", "status": "ok"}


root_router.include_router(auth_router)
root_router.include_router(public_router)
root_router.include_router(api_router)
app.include_router(root_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    await seed_data()
    logger.info("SIGMA startup complete: indexes, admin & seed data ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
