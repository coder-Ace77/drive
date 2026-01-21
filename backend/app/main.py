from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

from app.core.config import get_settings
from app.core.database import init_db
from app.api.router import api_router

settings = get_settings()

from app.services.cleanup_service import cleanup_service
import asyncio

async def run_cleanup_periodically():
    while True:
        try:
            await asyncio.sleep(30)
            await cleanup_service.cleanup_deleted_resources()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in cleanup task: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    
    # Start background task
    cleanup_task = asyncio.create_task(run_cleanup_periodically())
    
    yield
    
    # Cancel background task on shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Enterprise Drive Backend",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to the Enterprise Drive API"}
