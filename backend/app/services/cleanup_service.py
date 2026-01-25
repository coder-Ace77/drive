from app.models.resource import Resource, ResourceType
from app.models.user import User
from app.services.s3_service import s3_service
import asyncio
import datetime
from datetime import timezone

import logging
import time

logger = logging.getLogger(__name__)

class CleanupService:
    async def cleanup_orphan_s3_files(self) -> dict:
        logger.info("Starting orphan file cleanup...")
        
        s3_objects = s3_service.list_objects()
        if not s3_objects:
            return {"message": "No S3 objects found"}
            
        logger.info(f"Found {len(s3_objects)} S3 objects. Checking for orphans...")
        
        all_resources = await Resource.find(
            Resource.type == ResourceType.FILE,
            Resource.s3_key != None
        ).project(Resource.s3_key).to_list()
        
        known_keys = set(r.s3_key for r in all_resources if r.s3_key)
        
        orphans = []
        
        cutoff = datetime.datetime.now(timezone.utc) - datetime.timedelta(hours=1)
        
        for obj in s3_objects:
            if obj['Key'] not in known_keys:
                if obj['LastModified'] < cutoff:
                    orphans.append(obj['Key'])
        
        if not orphans:
            logger.info("No orphan files found.")
            return {"message": "No orphans found", "checked": len(s3_objects)}
            
        logger.info(f"Found {len(orphans)} orphan files. Deleting...")
        for key in orphans:
            s3_service.delete_file(key)
            
        return {"message": f"Deleted {len(orphans)} orphan files", "orphans": orphans}

    async def cleanup_deleted_resources(self) -> dict:
        res = await self._cleanup_db_deleted()
        orphan_res = await self.cleanup_orphan_s3_files()
        return {**res, "orphan_cleanup": orphan_res}

    async def _cleanup_db_deleted(self) -> dict:
        start_time = time.time()
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
            
            if keys_to_delete:
                logger.info(f"Deleting {len(keys_to_delete)} files from S3 for resource {resource.id}")
                for key in keys_to_delete:
                    s3_service.delete_file(key)
                total_s3_deleted += len(keys_to_delete)
            
            resources_to_delete = await Resource.find({"_id": {"$in": ids_to_delete}}).to_list()
            usage_reduction = {}
            
            for r in resources_to_delete:
                if r.type == ResourceType.FILE and r.size > 0:
                    oid = r.owner_id
                    usage_reduction[oid] = usage_reduction.get(oid, 0) + r.size
            
            for oid, size in usage_reduction.items():
                if size > 0:
                    user = await User.get(oid)
                    if user:
                        user.storage_used = max(0, user.storage_used - size)
                        await user.save()

            if ids_to_delete:
                await Resource.find({"_id": {"$in": ids_to_delete}}).delete()
                total_deleted_count += len(ids_to_delete)
            
            duration = time.time() - resource_start
            logger.info(f"Finished processing resource {resource.id} in {duration:.2f}s. Deleted {len(ids_to_delete)} DB items.")

        total_duration = time.time() - start_time
        logger.info(f"Cleanup task completed in {total_duration:.2f}s. Total resources deleted: {total_deleted_count}. Total S3 files suppressed: {total_s3_deleted}.")
        return {"message": f"Cleaned up {total_deleted_count} resources"}

cleanup_service = CleanupService()
