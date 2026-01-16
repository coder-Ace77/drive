from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import get_settings

settings = get_settings()

async def init_db():
    client = AsyncIOMotorClient(settings.database_url)
    db = client[settings.database_name]
    
    from app.models.user import User
    from app.models.resource import Resource
    
    await init_beanie(database=db, document_models=[User, Resource])
