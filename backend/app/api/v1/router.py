from fastapi import APIRouter
from app.api.v1 import auth, resources

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resources.router, tags=["resources"]) 
# Note: resources router defines endpoints like /folders, /upload which are root level in previous app
# But typically we group them.
# Previous app: /register (auth), /folders (resource)
# Let's keep prefixes minimal or match previous structure if possible, but encapsulated in /api/v1
