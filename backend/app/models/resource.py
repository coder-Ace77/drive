from typing import Optional, List
from pydantic import BaseModel
from beanie import Document, PydanticObjectId
from enum import Enum
from datetime import datetime

class ResourceType(str, Enum):
    FILE = "file"
    FOLDER = "folder"

class Permission(BaseModel):
    user_id: PydanticObjectId
    username: str
    type: str = "read"

class Resource(Document):
    name: str
    type: ResourceType
    s3_key: Optional[str] = None
    parent_id: Optional[PydanticObjectId] = None
    owner_id: PydanticObjectId
    size: int = 0
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()
    shared_with: List[Permission] = []
    
    class Settings:
        name = "resources"
        indexes = [
            "parent_id",
            "owner_id",
            [("parent_id", 1), ("name", 1), ("type", 1)]  # Compound index for uniqueness within folder check
        ]
