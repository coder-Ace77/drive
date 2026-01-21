from app.models.resource import Resource, ResourceType
from app.services.s3_service import s3_service
import asyncio

import logging
import time

logger = logging.getLogger(__name__)

class CleanupService:
    async def cleanup_deleted_resources(self) -> dict:
        start_time = time.time()
        print("Hello")
        logger.info("Starting cleanup_deleted_resources task")
        
        deleted_resources = await Resource.find(Resource.is_deleted == True).to_list()
        
        if not deleted_resources:
            logger.info("No resources marked for deletion found.")
            return {"message": "Nothing to cleanup"}
            
        logger.info(f"Found {len(deleted_resources)} top-level resources marked for deletion.")
        
        total_deleted_count = 0
        total_s3_deleted = 0
        
        for index, resource in enumerate(deleted_resources):
            resource_start = time.time()
            logger.info(f"Processing deletion for resource {resource.id} ({index + 1}/{len(deleted_resources)})")
            
            keys_to_delete = []
            ids_to_delete = []
            q = [resource.id]
            
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
            
            # Perform S3 Deletion
            if keys_to_delete:
                logger.info(f"Deleting {len(keys_to_delete)} files from S3 for resource {resource.id}")
                for key in keys_to_delete:
                    # In a real high-volume scenario, we might want to batch this or do parallel deletes
                    s3_service.delete_file(key)
                total_s3_deleted += len(keys_to_delete)
                
            # Perform DB Deletion
            if ids_to_delete:
                await Resource.find({"_id": {"$in": ids_to_delete}}).delete()
                total_deleted_count += len(ids_to_delete)
            
            duration = time.time() - resource_start
            logger.info(f"Finished processing resource {resource.id} in {duration:.2f}s. Deleted {len(ids_to_delete)} DB items.")

        total_duration = time.time() - start_time
        logger.info(f"Cleanup task completed in {total_duration:.2f}s. Total resources deleted: {total_deleted_count}. Total S3 files suppressed: {total_s3_deleted}.")
        return {"message": f"Cleaned up {total_deleted_count} resources"}

cleanup_service = CleanupService()
