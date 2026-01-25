from fastapi import APIRouter, Depends, Query
from typing import List
from app.models.user import User
from app.core.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()

class UserSearchResponse(BaseModel):
    username: str
    id: str

@router.get("/search", response_model=List[UserSearchResponse])
async def search_users(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user)
):
    users = await User.find(
        {"username": {"$regex": f"^{q}", "$options": "i"}}
    ).limit(5).to_list()
    
    return [UserSearchResponse(username=u.username, id=str(u.id)) for u in users]
