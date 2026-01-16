from pydantic import BaseModel
from typing import Optional, List
from beanie import PydanticObjectId
from datetime import datetime
from app.models.resource import ResourceType

class ResourceBase(BaseModel):
    name: str
    type: ResourceType

class PermissionSchema(BaseModel):
    user_id: PydanticObjectId
    username: str
    type: str

class FolderCreate(BaseModel):
    name: str
    parent_id: PydanticObjectId

class ResourceResponse(ResourceBase):
    id: PydanticObjectId
    s3_key: Optional[str] = None
    parent_id: Optional[PydanticObjectId] = None
    size: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    shared_with: List[PermissionSchema] = []

    class Config:
        arbitrary_types_allowed = True

class FolderContents(BaseModel):
    children: List[ResourceResponse]

class FileUploadInit(BaseModel):
    parent_id: PydanticObjectId
    file_name: str
    file_type: str
    relative_path: Optional[str] = None

class FileUploadResponse(BaseModel):
    url: str
    resource_id: PydanticObjectId
    s3_key: str
    actual_parent_id: PydanticObjectId
    
    class Config:
        arbitrary_types_allowed = True

class FileUploadConfirm(BaseModel):
    resource_id: PydanticObjectId
    parent_id: PydanticObjectId
    name: str
    size: int
    s3_key: str
