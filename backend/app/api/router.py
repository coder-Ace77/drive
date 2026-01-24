from app.api import auth
from fastapi import APIRouter
from app.api import resources

api_router = APIRouter()

from app.api import users

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(resources.router, tags=["resources"]) 
