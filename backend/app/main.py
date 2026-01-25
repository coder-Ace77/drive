from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from app.core.config import get_settings
from app.core.database import init_db
from app.api.router import api_router
from app.services.cleanup_service import cleanup_service
import asyncio

logging.basicConfig(level=logging.INFO,format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",)

settings = get_settings()

async def run_cleanup_periodically():
    while True:
        try:
            await asyncio.sleep(3600)
            await cleanup_service.cleanup_deleted_resources()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in cleanup task: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    
    cleanup_task = asyncio.create_task(run_cleanup_periodically())
    yield    
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Drive Backend",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to the Enterprise Drive API"}
