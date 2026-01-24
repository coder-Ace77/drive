from app.models.resource import Resource, ResourceType
from app.models.user import User
from app.services.s3_service import s3_service
import asyncio

import logging
import time

logger = logging.getLogger(__name__)

class CleanupService:
    async def cleanup_orphan_s3_files(self) -> dict:
        logger.info("Starting orphan file cleanup...")
        
        # 1. List all S3 objects
        s3_objects = s3_service.list_objects()
        if not s3_objects:
            return {"message": "No S3 objects found"}
            
        logger.info(f"Found {len(s3_objects)} S3 objects. Checking for orphans...")
        
        # 2. Get all known S3 keys from DB
        # This might be heavy for millions of records, but fine for now.
        # Optimize later by paginating or using sets.
        all_resources = await Resource.find(
            Resource.type == ResourceType.FILE,
            Resource.s3_key != None
        ).project(Resource.s3_key).to_list()
        
        known_keys = set(r.s3_key for r in all_resources if r.s3_key)
        
        orphans = []
        # Support safety buffer: only delete if older than 24h
        # But for "feel" user asked, maybe smaller buffer? Let's stick to 24h for safety.
        # Actually, user wants "orphan file cleaning", so let's be safe.
        import datetime
        from datetime import timezone
        
        cutoff = datetime.datetime.now(timezone.utc) - datetime.timedelta(hours=24)
        
        for obj in s3_objects:
            if obj['Key'] not in known_keys:
                # Check modification time
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
        # Run standard cleanup
        res = await self._cleanup_db_deleted()
        # Run orphan cleanup
        orphan_res = await self.cleanup_orphan_s3_files()
        return {**res, "orphan_cleanup": orphan_res}

    async def _cleanup_db_deleted(self) -> dict:
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
            
            # Update User Quota (Decrement) - Aggregate by owner
            # We need to look up the resources before deleting IDs to sum up size
            resources_to_delete = await Resource.find({"_id": {"$in": ids_to_delete}}).to_list()
            usage_reduction = {} # owner_id -> bytes
            
            for r in resources_to_delete:
                if r.type == ResourceType.FILE and r.size > 0:
                    oid = r.owner_id
                    usage_reduction[oid] = usage_reduction.get(oid, 0) + r.size
            
            # Apply reductions
            for oid, size in usage_reduction.items():
                if size > 0:
                    user = await User.get(oid)
                    if user:
                        user.storage_used = max(0, user.storage_used - size)
                        await user.save()

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
