from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List
from beanie import PydanticObjectId
from app.models.user import User
from app.models.resource import Resource, ResourceType, Permission
from app.schemas.resource import (
    ResourceResponse, FolderCreate, FolderContents, 
    FileUploadInit, FileUploadResponse, FileUploadConfirm
)
from app.core.deps import get_current_user
from app.services.s3_service import s3_service
import uuid
import zipfile
import os
from datetime import datetime
from jose import jwt, JWTError
from app.core.config import get_settings
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

settings = get_settings()

async def get_user_from_token(token: str) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await User.find_one(User.username == username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def cleanup_file(path: str):
    try:
        os.remove(path)
    except Exception:
        pass

router = APIRouter()

@router.post("/folders", response_model=ResourceResponse)
async def create_folder(
    folder_in: FolderCreate,
    current_user: User = Depends(get_current_user)
):
    parent = await Resource.get(folder_in.parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent folder not found")
        
    new_folder = Resource(
        name=folder_in.name,
        type=ResourceType.FOLDER,
        parent_id=folder_in.parent_id,
        owner_id=current_user.id
    )
    await new_folder.create()
    return new_folder

async def check_resource_access(resource: Resource, user: User) -> bool:
    if resource.owner_id == user.id:
        return True
    
    for perm in resource.shared_with:
        if perm.user_id == user.id:
            return True
            
    if resource.parent_id:
        parent = await Resource.get(resource.parent_id)
        if parent:
            return await check_resource_access(parent, user)
            
    return False

@router.get("/folders/{folder_id}", response_model=FolderContents)
async def get_folder_contents(
    folder_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    folder = await Resource.get(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    has_access = await check_resource_access(folder, current_user)
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    children = await Resource.find(Resource.parent_id == folder_id).to_list()
    return {"children": children}

@router.get("/tree")
async def get_tree(current_user: User = Depends(get_current_user)):    
    if not current_user.root_id:
        return {"tree": []}
    pipeline = [
        {"$match": {"_id": current_user.root_id}},
        {
            "$graphLookup": {
                "from": "resources",
                "startWith": "$_id",
                "connectFromField": "_id",
                "connectToField": "parent_id",
                "as": "descendants"
            }
        }
    ]
    
    collection = Resource.get_pymongo_collection()
    cursor = collection.aggregate(pipeline)
    results = await cursor.to_list(length=None)
    
    if not results:
        return {"tree": []}
        
    root = results[0]
    descendants = root.get("descendants", [])
    
    tree_nodes = [root] + descendants
    
    clean_nodes = []
    for node in tree_nodes:
        node["id"] = str(node["_id"])
        if "_id" in node: del node["_id"] 
        
        node["parent_id"] = str(node["parent_id"]) if node.get("parent_id") else None
        node["owner_id"] = str(node["owner_id"])        
        if "shared_with" in node and isinstance(node["shared_with"], list):
            for i, perm in enumerate(node["shared_with"]):
                if isinstance(perm, dict) and "user_id" in perm:
                   node["shared_with"][i]["user_id"] = str(perm["user_id"])

        if "descendants" in node: del node["descendants"]
        clean_nodes.append(node)        
    return {"tree": clean_nodes}

@router.post("/upload", response_model=FileUploadResponse)
async def init_upload(
    upload_in: FileUploadInit,
    current_user: User = Depends(get_current_user)
):
    target_parent_id = upload_in.parent_id
    
    if upload_in.relative_path and "/" in upload_in.relative_path:
        path_segments = upload_in.relative_path.split("/")[:-1]
        
        for segment in path_segments:
            existing = await Resource.find_one(
                Resource.parent_id == target_parent_id,
                Resource.name == segment,
                Resource.type == ResourceType.FOLDER
            )
            
            if existing:
                target_parent_id = existing.id
            else:
                new_folder = Resource(
                    name=segment,
                    type=ResourceType.FOLDER,
                    parent_id=target_parent_id,
                    owner_id=current_user.id
                )
                await new_folder.create()
                target_parent_id = new_folder.id

    resource_id = PydanticObjectId()
    
    s3_key = f"{current_user.id}/{resource_id}/{upload_in.file_name}"    
    url = s3_service.generate_presigned_url(s3_key, upload_in.file_type)
    
    return {
        "url": url,
        "resource_id": resource_id,
        "s3_key": s3_key,
        "actual_parent_id": target_parent_id
    }

@router.post("/upload/done", response_model=dict)
async def confirm_upload(
    confirm_in: FileUploadConfirm,
    current_user: User = Depends(get_current_user)
):
    new_file = Resource(
        id=confirm_in.resource_id, # Use the ID we pre-generated
        name=confirm_in.name,
        type=ResourceType.FILE,
        s3_key=confirm_in.s3_key,
        parent_id=confirm_in.parent_id,
        owner_id=current_user.id,
        size=confirm_in.size
    )
    await new_file.create()
    return {"status": "indexed", "resource_id": str(new_file.id)}

@router.post("/resources/{resource_id}/share", response_model=dict)
async def share_resource(
    resource_id: PydanticObjectId,
    share_in: dict, # { "username": "..." }
    current_user: User = Depends(get_current_user)
):
    target_username = share_in.get("username")
    if not target_username:
        raise HTTPException(status_code=400, detail="Username required")

    resource = await Resource.get(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    if resource.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not owner")

    target_user = await User.find_one(User.username == target_username)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with self")

    for perm in resource.shared_with:
        if perm.user_id == target_user.id:
            return {"message": "Already shared"}

    resource.shared_with.append(Permission(
        user_id=target_user.id,
        username=target_user.username,
        type="read"
    ))
    await resource.save()
    
    return {"message": "Shared successfully"}

@router.get("/shared", response_model=List[ResourceResponse])
async def get_shared_resources(
    current_user: User = Depends(get_current_user)
):    
    shared = await Resource.find(
        {"shared_with.user_id": current_user.id}
    ).to_list()
    
    return shared

@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    resource = await Resource.get(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    
    keys_to_delete = []
    ids_to_delete = []
    q = [resource_id]
    
    while q:
        curr_id = q.pop(0)
        curr = await Resource.get(curr_id)
        if curr:
            ids_to_delete.append(curr_id)
            if curr.type == ResourceType.FILE and curr.s3_key:
                keys_to_delete.append(curr.s3_key)
            
            children = await Resource.find(Resource.parent_id == curr_id).to_list()
            for child in children:
                q.append(child.id)
    
    for key in keys_to_delete:
        s3_service.delete_file(key)
        
    await Resource.find({"_id": {"$in": ids_to_delete}}).delete()    
    return {"message": "Deleted"}

@router.get("/download/{resource_id}")
async def get_download_link(
    resource_id: PydanticObjectId,
    request: Request,
    disposition: str = Query("attachment", regex="^(attachment|inline)$"),
    current_user: User = Depends(get_current_user)
):
    resource = await Resource.get(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="File not found")

    has_access = await check_resource_access(resource, current_user)
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
        
    if resource.type == ResourceType.FOLDER:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        token = auth_header.split(" ")[1]
        
        base = str(request.base_url).rstrip("/")        
        download_url = f"{base}/api/v1/download/zip/{resource.id}?token={token}"
        return {"url": download_url}
        
    if resource.type != ResourceType.FILE and resource.type != ResourceType.FOLDER:
        raise HTTPException(status_code=400, detail="Invalid resource type")
        
    if not resource.s3_key:
        raise HTTPException(status_code=404, detail="File content not found")

    url = s3_service.generate_presigned_download_url(resource.s3_key, disposition)
    return {"url": url}

@router.put("/resources/{resource_id}/content")
async def update_resource_content(
    resource_id: PydanticObjectId,
    content: Request, 
    current_user: User = Depends(get_current_user)
):
    resource = await Resource.get(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="File not found")    
    if resource.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can edit")
        
    if resource.type != ResourceType.FILE or not resource.s3_key:
        raise HTTPException(status_code=400, detail="Not a file")

    body = await content.body()
    await s3_service.upload_bytes(resource.s3_key, body)
    
    resource.size = len(body)
    resource.updated_at = datetime.now() # Need datetime import
    await resource.save()
    
    return {"message": "Saved"}

@router.get("/download/zip/{resource_id}")
async def download_folder_zip(
    resource_id: PydanticObjectId,
    token: str = Query(...)
):
    current_user = await get_user_from_token(token)
    resource = await Resource.get(resource_id)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")

    current_user = await get_user_from_token(token)
    resource = await Resource.get(resource_id)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")

    has_access = await check_resource_access(resource, current_user)
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
        
    if resource.type != ResourceType.FOLDER:
        raise HTTPException(status_code=400, detail="Not a folder")

    files_to_zip = []
    
    q = [(resource_id, "")]
    
    while q:
        curr_id, curr_path = q.pop(0)
        children = await Resource.find(Resource.parent_id == curr_id).to_list()
        
        for child in children:
            child_rel_path = f"{curr_path}/{child.name}" if curr_path else child.name
            
            if child.type == ResourceType.FILE and child.s3_key:
                files_to_zip.append((child.s3_key, child_rel_path))
            elif child.type == ResourceType.FOLDER:
                q.append((child.id, child_rel_path))

    if not files_to_zip:
        raise HTTPException(status_code=404, detail="Folder is empty")

    zip_filename = f"{resource.name}.zip"
    tmp_path = f"/tmp/{uuid.uuid4()}.zip"
    
    try:
        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for s3_key, rel_path in files_to_zip:
                tmp_file_path = f"/tmp/{uuid.uuid4()}"
                try:
                    s3_service.download_file(s3_key, tmp_file_path)
                    zipf.write(tmp_file_path, arcname=rel_path)
                finally:
                    if os.path.exists(tmp_file_path):
                        os.remove(tmp_file_path)
    except Exception as e:
        cleanup_file(tmp_path)
        raise HTTPException(status_code=500, detail=f"Zip creation failed: {str(e)}")

    return FileResponse(
        tmp_path, 
        filename=zip_filename, 
        background=BackgroundTask(cleanup_file, tmp_path)
    )
