from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from typing import Optional
from enum import Enum

class UserPlan(str, Enum):
    NORMAL = "normal"
    PRO = "pro"

class User(Document):
    username: Indexed(str, unique=True)
    hashed_password: str
    root_id: Optional[PydanticObjectId] = None
    
    plan: UserPlan = UserPlan.NORMAL
    storage_used: int = 0
    
    @property
    def storage_limit(self) -> int:
        if self.plan == UserPlan.PRO:
             return 2 * 1024 * 1024 * 1024 # 2 GB
        return 250 * 1024 * 1024 # 250 MB

    class Settings:
        name = "users"
