from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.user import UserCreate, UserResponse
from app.models.user import User
from app.core.deps import get_current_user
from app.services.auth_service import auth_service


router = APIRouter()

@router.post("/register", response_model=dict)
async def register(user_in: UserCreate):
    return await auth_service.register_user(user_in)

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    return await auth_service.authenticate_user(form_data.username, form_data.password)

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
