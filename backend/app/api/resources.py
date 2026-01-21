from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List
from beanie import PydanticObjectId
from app.models.user import User
from app.models.resource import Resource, ResourceType, Permission
from app.schemas.resource import (
    ResourceResponse, FolderCreate, FolderContents, 
    FileUploadInit, FileUploadResponse, FileUploadConfirm, BulkFileUploadInit,
    BulkDeleteRequest, TreeDelta, BulkInitResponse, ResourceMoveRequest
)
from app.core.deps import get_current_user
from app.services.metadata_service import metadata_service
from app.services.upload_service import upload_service
from app.services.download_service import download_service
from app.services.cleanup_service import cleanup_service
import os

router = APIRouter()

@router.post("/folders", response_model=ResourceResponse)
async def create_folder(
    folder_in: FolderCreate,
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.create_folder(folder_in, current_user)

@router.get("/folders/{folder_id}", response_model=FolderContents)
async def get_folder_contents(
    folder_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.get_folder_contents(folder_id, current_user)

@router.get("/tree")
async def get_tree(current_user: User = Depends(get_current_user)):    
    return await metadata_service.get_tree(current_user)

@router.post("/upload/init", response_model=dict)
async def init_upload(
    upload_in: FileUploadInit,
    current_user: User = Depends(get_current_user)
):
    return await upload_service.init_upload(upload_in, current_user)

@router.post("/upload/bulk", response_model=BulkInitResponse)
async def init_upload_bulk(
    bulk_in: BulkFileUploadInit,
    current_user: User = Depends(get_current_user)
):
    return await upload_service.init_upload_bulk(bulk_in, current_user)

@router.post("/upload/confirm", response_model=ResourceResponse)
async def confirm_upload(
    confirm_in: FileUploadConfirm,
    current_user: User = Depends(get_current_user)
):
    return await upload_service.confirm_upload(confirm_in, current_user)

@router.post("/resources/{resource_id}/share", response_model=dict)
async def share_resource(
    resource_id: PydanticObjectId,
    share_in: dict, # { "username": "..." }
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.share_resource(resource_id, share_in.get("username"), current_user)

@router.get("/shared", response_model=List[ResourceResponse])
async def get_shared_resources(
    current_user: User = Depends(get_current_user)
):    
    return await metadata_service.get_shared_resources(current_user)

@router.delete("/resources/bulk-delete", response_model=TreeDelta)
async def delete_resources_bulk(
    bulk_in: BulkDeleteRequest,
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.delete_resources_bulk(bulk_in.resource_ids, current_user)

@router.delete("/resources/{resource_id}", response_model=TreeDelta)
async def delete_resource(
    resource_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.delete_resource(resource_id, current_user)

@router.get("/download/{resource_id}")
async def get_download_link(
    resource_id: PydanticObjectId,
    request: Request,
    disposition: str = Query("attachment", regex="^(attachment|inline)$"),
    current_user: User = Depends(get_current_user)
):
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        
    base_url = str(request.base_url).rstrip("/")
    return await download_service.get_download_link(resource_id, disposition, current_user, token, base_url)

@router.put("/resources/{resource_id}/content")
async def update_resource_content(
    resource_id: PydanticObjectId,
    content: Request, 
    current_user: User = Depends(get_current_user)
):
    body = await content.body()
    return await metadata_service.update_resource_content(resource_id, body, current_user)

@router.get("/download/zip/{resource_id}")
async def download_folder_zip(
    resource_id: PydanticObjectId,
    token: str = Query(...)
):
    return await download_service.stream_folder_zip(resource_id, token)

@router.post("/resources/move", response_model=TreeDelta)
async def move_resources(
    move_in: ResourceMoveRequest,
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.move_resources(move_in.resource_ids, move_in.target_parent_id, current_user)

@router.post("/resources/copy", response_model=TreeDelta)
async def copy_resources(
    copy_in: ResourceMoveRequest, # We can reuse the schema as it has ids and target
    current_user: User = Depends(get_current_user)
):
    return await metadata_service.copy_resources(copy_in.resource_ids, copy_in.target_parent_id, current_user)

@router.post("/cleanup", response_model=dict)
async def trigger_cleanup(
    current_user: User = Depends(get_current_user)
):
    # In a real app, restrict this to admin users
    return await cleanup_service.cleanup_deleted_resources()
