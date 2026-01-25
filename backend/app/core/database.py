from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import get_settings
from app.models.user import User
from app.models.resource import Resource

settings = get_settings()

import dns.resolver

async def init_db():
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ['8.8.8.8']
    
    client = AsyncIOMotorClient(settings.database_url)
    db = client[settings.database_name]
    await init_beanie(database=db, document_models=[User, Resource])
