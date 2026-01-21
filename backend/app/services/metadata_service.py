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

logger = logging.getLogger(__name__)


class MetadataService:
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
        
        # Filter root just in case, though usually root shouldn't be deleted
        if root.get("is_deleted") is True:
            return {"tree": []}

        tree_nodes = [root] + descendants
        
        clean_nodes = []
        for node in tree_nodes:
            # Skip if explicitly deleted (double check for safety)
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
            clean_nodes.append(node)   

        duration = time.time() - start_time
        logger.info(f"Tree fetch completed in {duration:.4f}s. Nodes: {len(clean_nodes)}")
        return {"tree": clean_nodes}

    async def share_resource(self, resource_id: PydanticObjectId, target_username: str, current_user: User) -> dict:
        if not target_username:
            raise HTTPException(status_code=400, detail="Username required")
    
        resource = await Resource.get(resource_id)
        if not resource or resource.is_deleted:
            raise HTTPException(status_code=404, detail="Resource not found")
            
        permission_service.verify_owner(resource, current_user)
    
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
        
        permission_service.verify_owner(resource, current_user)
        
        resource.is_deleted = True
        resource.deleted_at = datetime.now()
        await resource.save()
        
        return {
            "deleted": [resource_id],
            "added": [],
            "updated": []
        }

    async def delete_resources_bulk(self, resource_ids: List[PydanticObjectId], current_user: User) -> dict:
        # 1. Find all resources that exist, are NOT deleted, and belong to current_user
        to_delete = await Resource.find(
            {"_id": {"$in": resource_ids}},
            Resource.owner_id == current_user.id,
            Resource.is_deleted != True
        ).to_list()
        
        if not to_delete:
            return {"message": "No valid resources to delete", "deleted_count": 0}
            
        real_ids = [r.id for r in to_delete]
        
        # 2. Bulk Update
        await Resource.find(
            {"_id": {"$in": real_ids}}
        ).update(
            {"$set": {"is_deleted": True, "deleted_at": datetime.now()}}
        )
        
        return {
            "deleted": real_ids,
            "added": [],
            "updated": []
        }

    async def update_resource_content(self, resource_id: PydanticObjectId, content_body: bytes, current_user: User) -> dict:
        resource = await Resource.get(resource_id)
        if not resource:
            raise HTTPException(status_code=404, detail="File not found")    
        
        permission_service.verify_owner(resource, current_user)
            
        if resource.type != ResourceType.FILE or not resource.s3_key:
            raise HTTPException(status_code=400, detail="Not a file")
    
        await s3_service.upload_bytes(resource.s3_key, content_body)
        
        resource.size = len(content_body)
        resource.updated_at = datetime.now()
        await resource.save()
        
        return {"message": "Saved"}

    async def move_resources(self, resource_ids: List[PydanticObjectId], target_parent_id: PydanticObjectId, current_user: User) -> dict:
        # 1. Verify target folder
        target_folder = await Resource.get(target_parent_id)
        if not target_folder:
            raise HTTPException(status_code=404, detail="Target folder not found")
        
        if target_folder.type != ResourceType.FOLDER:
            raise HTTPException(status_code=400, detail="Target must be a folder")
            
        permission_service.verify_owner(target_folder, current_user)
        
        # 2. Get resources to move
        resources = await Resource.find(
            {"_id": {"$in": resource_ids}},
            Resource.owner_id == current_user.id,
            Resource.is_deleted != True
        ).to_list()
        
        if not resources:
            return {"added": [], "updated": [], "deleted": []}
            
        # 3. Circular Dependency Check
        # If we are moving a folder, we must ensure the target is NOT inside that folder.
        # We can check if target_folder's ancestors include any of the resource_ids.
        # This requires traversing up from target_folder until we hit root or one of the moving IDs.
        
        # Optimized check: tracing back up
        curr = target_folder
        while curr.parent_id:
            if curr.id in resource_ids: # moving a folder into itself or its descendant
                raise HTTPException(status_code=400, detail="Cannot move a folder into itself")
            
            # Optimization: If we hit user root, stop?
            if curr.id == current_user.root_id:
                break
                
            parent = await Resource.get(curr.parent_id)
            if not parent: 
                break
            curr = parent
            
        # 4. Update Parent IDs
        updated_resources = []
        for res in resources:
            if res.id == target_parent_id:
                 raise HTTPException(status_code=400, detail="Cannot move a folder into itself")
            
            if res.parent_id != target_parent_id:
                res.parent_id = target_parent_id
                res.updated_at = datetime.now()
                await res.save()
                updated_resources.append(res)
                
        return {
            "added": [],
            "updated": updated_resources,
            "deleted": []
        }

    async def copy_resources(self, resource_ids: List[PydanticObjectId], target_parent_id: PydanticObjectId, current_user: User) -> dict:
        # 1. Verify target
        target_folder = await Resource.get(target_parent_id)
        if not target_folder or target_folder.type != ResourceType.FOLDER:
             raise HTTPException(status_code=404, detail="Target folder not found")
        permission_service.verify_owner(target_folder, current_user)
        
        # 2. Get resources
        sources = await Resource.find(
            {"_id": {"$in": resource_ids}},
            Resource.owner_id == current_user.id,
            Resource.is_deleted != True
        ).to_list()
        
        added_resources = []
        
        # 3. Recursive Copy Function
        async def recursive_copy(original: Resource, new_parent_id: PydanticObjectId):
            # Create copy of the node
            new_node = Resource(
                name=original.name, # logic to handle duplicates? e.g. "Copy of..."? For now keep same name.
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
                # Find children
                children = await Resource.find(
                    Resource.parent_id == original.id,
                    Resource.is_deleted != True
                ).to_list()
                
                for child in children:
                    await recursive_copy(child, new_node.id)

        # 4. Execute Copy
        for src in sources:
            # Check if copying into itself (infinite loop risk if using naive logic, usually safe if we copy to new ID)
            # Copying a folder into its own child is technically impossible since the child is inside it.
            # But copying a folder into itself (same parent) creates a duplicate sibling.
            await recursive_copy(src, target_parent_id)
            
        return {
            "added": added_resources,
            "updated": [],
            "deleted": []
        }

metadata_service = MetadataService()
