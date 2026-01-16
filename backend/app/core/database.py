from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import get_settings
# Import models here to initialize them
# from app.models.user import User
# from app.models.resource import Resource

settings = get_settings()

async def init_db():
    client = AsyncIOMotorClient(settings.database_url)
    db = client[settings.database_name]
    
    # Improved: Dynamic model importing to avoid circular imports during init if possible,
    # but explicit import is usually safer for Beanie init.
    from app.models.user import User
    from app.models.resource import Resource
    
    await init_beanie(database=db, document_models=[User, Resource])
