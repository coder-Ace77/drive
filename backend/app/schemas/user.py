from pydantic import BaseModel
from typing import Optional
from beanie import PydanticObjectId

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: PydanticObjectId
    root_id: Optional[PydanticObjectId]
    plan: str
    storage_used: int
    storage_limit: int

    class Config:
        arbitrary_types_allowed = True
