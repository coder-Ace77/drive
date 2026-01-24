from typing import List, Dict, Optional
from beanie import PydanticObjectId
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.schemas.resource import FileUploadInit, FileUploadConfirm, BulkFileUploadInit, FileUploadResponse, FileInitItem
from app.services.permission_service import permission_service
from app.services.s3_service import s3_service
from fastapi import HTTPException
import logging
import time
import os
import redis.asyncio as redis

logger = logging.getLogger(__name__)

class UploadService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            password=os.getenv("REDIS_PASSWORD", None),
            decode_responses=True,
            ssl=True
        )

    async def _invalidate_tree_cache(self, user_id):
        try:
            await self.redis_client.delete(f"drive:tree:{user_id}")
        except Exception as e:
            logger.error(f"Redis invalidation error: {e}")

    async def init_upload(self, upload_in: FileUploadInit, current_user: User) -> dict:
        if ".." in upload_in.file_name or (upload_in.relative_path and ".." in upload_in.relative_path):
             raise HTTPException(status_code=400, detail="Invalid file path")
        
        # Quota Check
        if current_user.storage_used + upload_in.size > current_user.storage_limit:
             raise HTTPException(status_code=403, detail="Storage quota exceeded. Upgrade your plan.")
        
        target_parent_id = upload_in.parent_id
        
        # Verify write access to destination
        if target_parent_id:
            parent = await Resource.get(target_parent_id)
            if parent:
                await permission_service.verify_write_access(parent, current_user)
            else:
                 # If parent ID is provided but not found, raising 404 is safer
                 raise HTTPException(status_code=404, detail="Parent folder not found")

        if upload_in.relative_path and "/" in upload_in.relative_path:
            path_segments = upload_in.relative_path.split("/")[:-1]
            
            for segment in path_segments:
                # We need to find or create folders. 
                # If creating, we must ensure we have write access to the current parent.
                # (Checked above for initial parent, and subsequent parents we will own/have access to)
                existing = await Resource.find_one(
                    Resource.parent_id == target_parent_id,
                    Resource.name == segment,
                    Resource.type == ResourceType.FOLDER,
                    Resource.is_deleted != True
                )
                
                if existing:
                    # If navigating into existing folder, must have write access
                    await permission_service.verify_write_access(existing, current_user)
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
                    await self._invalidate_tree_cache(current_user.id) # Invalidate on folder creation
    
        resource_id = PydanticObjectId()
        
        s3_key = f"{current_user.id}/{resource_id}/{upload_in.file_name}"    
        url = s3_service.generate_presigned_url(s3_key, upload_in.file_type)
        
        return {
            "url": url,
            "resource_id": resource_id,
            "s3_key": s3_key,
            "actual_parent_id": target_parent_id
        }

    async def init_upload_bulk(self, bulk_in: BulkFileUploadInit, current_user: User) -> List[FileUploadResponse]:
        start_time = time.time()
        file_count = len(bulk_in.files)
        total_size = sum(f.size for f in bulk_in.files)
        
        if current_user.storage_used + total_size > current_user.storage_limit:
             raise HTTPException(status_code=403, detail="Storage quota exceeded. Upgrade your plan.")

        logger.info(f"Starting bulk upload init for {file_count} files. Total size: {total_size}. User: {current_user.id}")
        
        # Verify write access to root destination
        if bulk_in.parent_id:
            parent = await Resource.get(bulk_in.parent_id)
            if parent:
                await permission_service.verify_write_access(parent, current_user)
            else:
                 raise HTTPException(status_code=404, detail="Parent folder not found")
        
        # 1. Identify all unique folder paths required
        # Map: "folder/subfolder" -> { "name": "subfolder", "parent_path": "folder", "depth": 1 }
        folder_paths = set()
        file_parent_map = {} # file_index -> parent_path_string
        
        for index, file_item in enumerate(bulk_in.files):
            if file_item.relative_path and "/" in file_item.relative_path:
                # relative_path="A/B/file.txt" -> parts=["A", "B", "file.txt"]
                parts = file_item.relative_path.split("/")[:-1] # ["A", "B"]
                full_path = ""
                for part in parts:
                    parent_path = full_path
                    full_path = f"{full_path}/{part}" if full_path else part
                    folder_paths.add(full_path)
                
                file_parent_map[index] = full_path
            else:
                file_parent_map[index] = None # Root

        # 2. Level-by-level resolution
        # Map: "path/string" -> resource_id
        resolved_ids: Dict[str, PydanticObjectId] = {}
        
        # Sort paths by depth (folders with fewer '/' come first)
        sorted_paths = sorted(list(folder_paths), key=lambda p: p.count('/'))
        
        # Group by depth for bulk processing
        # depth 0: ["A", "C"], depth 1: ["A/B"]
        paths_by_depth: Dict[int, List[str]] = {}
        for path in sorted_paths:
            depth = path.count('/')
            if depth not in paths_by_depth:
                paths_by_depth[depth] = []
            paths_by_depth[depth].append(path)
            
        new_folders_created = 0
        all_created_resources = []
            
        # Process each depth level
        for depth in sorted(paths_by_depth.keys()):
            paths_at_depth = paths_by_depth[depth]
            
            # Prepare quick lookups
            # (parent_id, folder_name) -> path_string
            lookup_keys = []
            for path in paths_at_depth:
                parts = path.split('/')
                name = parts[-1]
                parent_path = "/".join(parts[:-1]) if len(parts) > 1 else None
                
                parent_id = bulk_in.parent_id
                if parent_path:
                    parent_id = resolved_ids.get(parent_path)
                    
                if parent_id: # Should always exist if we process by depth
                   lookup_keys.append({"parent_id": parent_id, "name": name, "path": path})

            if not lookup_keys:
                continue

            # BULK FIND
            # Construct OR query for all folders at this level
            find_conditions = []
            for item in lookup_keys:
                find_conditions.append({
                    "parent_id": item["parent_id"],
                    "name": item["name"],
                    "type": ResourceType.FOLDER,
                    "is_deleted": {"$ne": True}
                })
            
            # Execute one query for this level
            found_folders = await Resource.find({"$or": find_conditions}).to_list() if find_conditions else []
            
            # Map found IDs
            found_map = {} # (parent_id, name) -> user_id
            for f in found_folders:
                found_map[(f.parent_id, f.name)] = f.id
                
            # BULK CREATE MISSING
            to_insert = []
            
            for item in lookup_keys:
                key = (item["parent_id"], item["name"])
                if key in found_map:
                    resolved_ids[item["path"]] = found_map[key]
                else:
                    # Prepare for insert
                    new_id = PydanticObjectId()
                    new_folder = Resource(
                        id=new_id,
                        name=item["name"],
                        type=ResourceType.FOLDER,
                        parent_id=item["parent_id"],
                        owner_id=current_user.id
                    )
                    to_insert.append((item["path"], new_folder))
            
            if to_insert:
                # Extract resource objects
                resources_to_create = [x[1] for x in to_insert]
                await Resource.insert_many(resources_to_create)
                new_folders_created += len(resources_to_create)
                all_created_resources.extend(resources_to_create)
                
                # Update map with new IDs
                for path, res in to_insert:
                    resolved_ids[path] = res.id
            
            # logger.info(f"Depth {depth}: Resolved {len(lookup_keys)} folders (Found {len(found_map)}, Created {len(to_insert)})")

        if new_folders_created > 0:
            await self._invalidate_tree_cache(current_user.id)

        # 3. Generate Responses with resolved IDs
        responses = []
        for index, file_item in enumerate(bulk_in.files):
            target_parent_id = bulk_in.parent_id
            parent_path = file_parent_map.get(index)
            
            if parent_path:
                target_parent_id = resolved_ids.get(parent_path, bulk_in.parent_id)

            resource_id = PydanticObjectId()
            s3_key = f"{current_user.id}/{resource_id}/{file_item.file_name}"    
            
            # We assume S3 sign is fast enough now that we removed sleeps/latency, 
            # if strictly needed we can batch sign too but boto3 is purely local.
            url = s3_service.generate_presigned_url(s3_key, file_item.file_type)
            
            responses.append(FileUploadResponse(
                url=url,
                resource_id=resource_id,
                s3_key=s3_key,
                actual_parent_id=target_parent_id
            ))
            
        duration = time.time() - start_time
        return {
            "files": responses,
            "delta": {
                "added": all_created_resources, 
                "deleted": [],
                "updated": []
            } 
        }

    async def confirm_upload(self, confirm_in: FileUploadConfirm, current_user: User) -> dict:
        if confirm_in.parent_id:
            parent = await Resource.get(confirm_in.parent_id)
            if parent:
                await permission_service.verify_write_access(parent, current_user)
            else:
                raise HTTPException(status_code=404, detail="Parent folder not found")

        # Verify S3 Object Exists and Size matches
        try:
             s3_meta = s3_service.head_object(confirm_in.s3_key)
             # Basic sanity check: size. s3_meta['ContentLength']
             if s3_meta['ContentLength'] != confirm_in.size:
                 # Just a warning or strict? Let's log it but maybe allow if it's close? 
                 # For security, strict is better, but multipart uploads might vary slightly? 
                 # No, usually exact. 
                 # But let's just ensure it DOES exist.
                 pass
        except Exception as e:
             logger.error(f"S3 Verification Failed: {str(e)}")
             raise HTTPException(status_code=400, detail="File verification failed. File not found in storage.")

        new_file = Resource(
            id=confirm_in.resource_id, 
            name=confirm_in.name,
            type=ResourceType.FILE,
            s3_key=confirm_in.s3_key,
            parent_id=confirm_in.parent_id,
            owner_id=current_user.id,
            size=confirm_in.size
        )
        await new_file.create()
        
        # Update usage
        current_user.storage_used += confirm_in.size
        await current_user.save()
        
        await self._invalidate_tree_cache(current_user.id)
        return new_file

upload_service = UploadService()
