from fastapi import HTTPException
from typing import List
from beanie import PydanticObjectId
from app.models.user import User
from app.models.resource import Resource, ResourceType, Permission
from app.schemas.resource import FolderCreate
from app.services.s3_service import s3_service
from app.services.permission_service import permission_service
from datetime import datetime
import logging
import time
import os
import redis.asyncio as redis
import json
from beanie.operators import In

logger = logging.getLogger(__name__)


class MetadataService:
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

    async def create_folder(self, folder_in: FolderCreate, current_user: User) -> Resource:
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
        await self._invalidate_tree_cache(current_user.id)
        return new_folder

    async def get_folder_contents(self, folder_id: PydanticObjectId, current_user: User) -> dict:
        folder = await Resource.get(folder_id)
        if not folder or folder.is_deleted:
            raise HTTPException(status_code=404, detail="Folder not found")
            
        await permission_service.verify_has_access(folder, current_user)

        children = await Resource.find(
            Resource.parent_id == folder_id,
            Resource.is_deleted != True
        ).to_list()
        return {"children": children}

    async def get_tree(self, current_user: User) -> dict:
        start_time = time.time()
        
        cache_key = f"drive:tree:{current_user.id}"
        try:
            cached_tree = await self.redis_client.get(cache_key)
            if cached_tree:
                logger.info("Serving tree from Redis cache")
                return json.loads(cached_tree)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            
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
                    "as": "descendants",
                    "restrictSearchWithMatch": {"is_deleted": {"$ne": True}}
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
        
        if root.get("is_deleted") is True:
            return {"tree": []}

        tree_nodes = [root] + descendants
        
        clean_nodes = []
        for node in tree_nodes:
            if node.get("is_deleted") is True:
                continue

            node["id"] = str(node["_id"])
            if "_id" in node: del node["_id"] 
            
            node["parent_id"] = str(node["parent_id"]) if node.get("parent_id") else None
            node["owner_id"] = str(node["owner_id"])        
            if "shared_with" in node and isinstance(node["shared_with"], list):
                for i, perm in enumerate(node["shared_with"]):
                    if isinstance(perm, dict) and "user_id" in perm:
                       node["shared_with"][i]["user_id"] = str(perm["user_id"])
    
            if "descendants" in node: del node["descendants"]

            if node.get("created_at") and isinstance(node["created_at"], datetime):
                node["created_at"] = node["created_at"].isoformat()
            if node.get("updated_at") and isinstance(node["updated_at"], datetime):
                node["updated_at"] = node["updated_at"].isoformat()
            if node.get("deleted_at") and isinstance(node["deleted_at"], datetime):
                node["deleted_at"] = node["deleted_at"].isoformat()
                
            clean_nodes.append(node)

        duration = time.time() - start_time
        logger.info(f"Tree fetch completed in {duration:.4f}s. Nodes: {len(clean_nodes)}")
        
        result = {"tree": clean_nodes}
        
        try:
             await self.redis_client.setex(cache_key, 300, json.dumps(result))
        except Exception as e:
             logger.error(f"Redis set error: {e}")
             
        return result

    async def share_resource(self, resource_id: PydanticObjectId, username: str, current_user: User, permission_type: str = "read") -> dict:
        resource = await Resource.get(resource_id)
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
            
        await permission_service.verify_owner(resource, current_user)
        
        user_to_share = await User.find_one(User.username == username)
        if not user_to_share:
            raise HTTPException(status_code=404, detail="User not found")
            
        if user_to_share.id == current_user.id:
             raise HTTPException(status_code=400, detail="Cannot share with yourself")

        if permission_type not in ["read", "editor"]:
            raise HTTPException(status_code=400, detail="Invalid permission type. Must be 'read' or 'editor'")
        
        existing = next((p for p in resource.shared_with if p.user_id == user_to_share.id), None)
        if existing:
            existing.type = permission_type
        else:
            resource.shared_with.append(Permission(
                user_id=user_to_share.id, 
                username=user_to_share.username,
                type=permission_type
            ))
            
        await resource.save()
        return resource

    async def unshare_resource(self, resource_id: PydanticObjectId, username: str, current_user: User) -> dict:
        resource = await Resource.get(resource_id)
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
            
        await permission_service.verify_owner(resource, current_user)
        
        user_to_unshare = await User.find_one(User.username == username)
        
        if user_to_unshare:
             await Resource.find({"_id": resource_id}).update(
                 {"$pull": {"shared_with": {"user_id": user_to_unshare.id}}}
             )
        else:
             await Resource.find({"_id": resource_id}).update(
                 {"$pull": {"shared_with": {"username": username}}}
             )
        
        updated_resource = await Resource.get(resource_id)
        return updated_resource

    async def get_shared_resources(self, current_user: User) -> List[Resource]:
        shared = await Resource.find(
            {"shared_with.user_id": current_user.id},
            Resource.is_deleted != True
        ).to_list()
        
        return shared

    async def delete_resource(self, resource_id: PydanticObjectId, current_user: User) -> dict:
        resource = await Resource.get(resource_id)
        if not resource or resource.is_deleted:
            raise HTTPException(status_code=404, detail="Not found")
        
        await permission_service.verify_write_access(resource, current_user)
        
        resource.is_deleted = True
        resource.deleted_at = datetime.now()
        await resource.save()
        
        await self._invalidate_tree_cache(current_user.id)
        
        return {
            "deleted": [resource_id],
            "added": [],
            "updated": []
        }

    async def delete_resources_bulk(self, resource_ids: List[PydanticObjectId], current_user: User) -> dict:
        to_delete_candidates = await Resource.find(
            {"_id": {"$in": resource_ids}},
            Resource.is_deleted != True
        ).to_list()
        
        real_ids = []
        for res in to_delete_candidates:
            try:
                if await permission_service.check_write_access(res, current_user):
                    real_ids.append(res.id)
            except:
                pass
        
        if not real_ids:
            return {"message": "No valid resources to delete", "deleted_count": 0}
            
        await Resource.find(
            {"_id": {"$in": real_ids}}
        ).update(
            {"$set": {"is_deleted": True, "deleted_at": datetime.now()}}
        )
        
        await self._invalidate_tree_cache(current_user.id)
        
        return {
            "deleted": real_ids,
            "added": [],
            "updated": []
        }

    async def update_resource_content(self, resource_id: PydanticObjectId, content_body: bytes, current_user: User) -> dict:
        resource = await Resource.get(resource_id)
        if not resource:
            raise HTTPException(status_code=404, detail="File not found")    
        
        await permission_service.verify_write_access(resource, current_user)
            
        if resource.type != ResourceType.FILE or not resource.s3_key:
            raise HTTPException(status_code=400, detail="Not a file")
    
        await s3_service.upload_bytes(resource.s3_key, content_body)
        
        resource.size = len(content_body)
        resource.updated_at = datetime.now()
        await resource.save()
        
        return {"message": "Saved"}

    async def move_resources(self, resource_ids: List[PydanticObjectId], target_parent_id: PydanticObjectId, current_user: User) -> dict:
        target_folder = await Resource.get(target_parent_id)
        if not target_folder:
            raise HTTPException(status_code=404, detail="Target folder not found")
        
        if target_folder.type != ResourceType.FOLDER:
            raise HTTPException(status_code=400, detail="Target must be a folder")
            
        await permission_service.verify_write_access(target_folder, current_user)
        
        resources_candidates = await Resource.find(
            {"_id": {"$in": resource_ids}},
            Resource.is_deleted != True
        ).to_list()
        
        resources = []
        for res in resources_candidates:
            if await permission_service.check_write_access(res, current_user):
                resources.append(res)
        
        if not resources:
            return {"added": [], "updated": [], "deleted": []}
            
        curr = target_folder
        while curr.parent_id:
            if curr.id in resource_ids: 
                raise HTTPException(status_code=400, detail="Cannot move a folder into itself")
            
            if curr.id == current_user.root_id:
                break
            
            parent = await Resource.get(curr.parent_id)
            if not parent: 
                break
            curr = parent
            
        updated_resources = []
        for res in resources:
            if res.id == target_parent_id:
                 raise HTTPException(status_code=400, detail="Cannot move a folder into itself")
            
            if res.parent_id != target_parent_id:
                res.parent_id = target_parent_id
                res.updated_at = datetime.now()
                await res.save()
                updated_resources.append(res)
        
        await self._invalidate_tree_cache(current_user.id)
                
        return {
            "added": [],
            "updated": updated_resources,
            "deleted": []
        }

    async def copy_resources(self, resource_ids: List[PydanticObjectId], target_parent_id: PydanticObjectId, current_user: User) -> dict:
        target_folder = await Resource.get(target_parent_id)
        if not target_folder or target_folder.type != ResourceType.FOLDER:
             raise HTTPException(status_code=404, detail="Target folder not found")
        await permission_service.verify_write_access(target_folder, current_user)
        candidates = await Resource.find(
            {"_id": {"$in": resource_ids}},
            Resource.is_deleted != True
        ).to_list()
        
        sources = []
        for res in candidates:
             if await permission_service.check_resource_access(res, current_user): # Copy only needs read access on source!
                 sources.append(res)
        
        added_resources = []
        
        total_copy_size = 0
        
        async def calculate_size(res: Resource):
            size = 0
            if res.type == ResourceType.FILE:
                size += res.size
            elif res.type == ResourceType.FOLDER:
                 children = await Resource.find(
                    Resource.parent_id == res.id,
                    Resource.is_deleted != True
                 ).to_list()
                 for child in children:
                     size += await calculate_size(child)
            return size

        for src in sources:
            total_copy_size += await calculate_size(src)

        if current_user.storage_used + total_copy_size > current_user.storage_limit:
             raise HTTPException(status_code=403, detail="Storage quota exceeded. Upgrade your plan.")
        
        async def recursive_copy(original: Resource, new_parent_id: PydanticObjectId):
            new_node = Resource(
                name=original.name, 
                type=original.type,
                parent_id=new_parent_id,
                owner_id=current_user.id,
                size=original.size,
                s3_key=original.s3_key if original.type == ResourceType.FILE else None,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            await new_node.create()
            added_resources.append(new_node)
            
            if original.type == ResourceType.FOLDER:
                children = await Resource.find(
                    Resource.parent_id == original.id,
                    Resource.is_deleted != True
                ).to_list()
                
                for child in children:
                    await recursive_copy(child, new_node.id)

        for src in sources:
            await recursive_copy(src, target_parent_id)
            
        if total_copy_size > 0:
            current_user.storage_used += total_copy_size
            await current_user.save()
            
        await self._invalidate_tree_cache(current_user.id)
            
        return {
            "added": added_resources,
            "updated": [],
            "deleted": []
        }

metadata_service = MetadataService()
