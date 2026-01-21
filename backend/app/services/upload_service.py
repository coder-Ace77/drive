from typing import List, Dict, Optional
from beanie import PydanticObjectId
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.schemas.resource import FileUploadInit, FileUploadConfirm, BulkFileUploadInit, FileUploadResponse, FileInitItem
from app.services.s3_service import s3_service
import logging
import time

logger = logging.getLogger(__name__)

class UploadService:
    async def init_upload(self, upload_in: FileUploadInit, current_user: User) -> dict:
        target_parent_id = upload_in.parent_id
        
        if upload_in.relative_path and "/" in upload_in.relative_path:
            path_segments = upload_in.relative_path.split("/")[:-1]
            
            for segment in path_segments:
                existing = await Resource.find_one(
                    Resource.parent_id == target_parent_id,
                    Resource.name == segment,
                    Resource.type == ResourceType.FOLDER,
                    Resource.is_deleted != True
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

    async def init_upload_bulk(self, bulk_in: BulkFileUploadInit, current_user: User) -> List[FileUploadResponse]:
        start_time = time.time()
        file_count = len(bulk_in.files)
        logger.info(f"Starting bulk upload init for {file_count} files. User: {current_user.id}")
        
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
        return new_file

upload_service = UploadService()
