from fastapi import HTTPException
from app.models.user import User
from app.models.resource import Resource

class PermissionService:
    async def check_resource_access(self, resource: Resource, user: User) -> bool:
        if resource.owner_id == user.id:
            return True
        
        for perm in resource.shared_with:
            if perm.user_id == user.id:
                return True
                
        if resource.parent_id:
            parent = await Resource.get(resource.parent_id)
            if parent:
                return await self.check_resource_access(parent, user)
                
        return False

    async def verify_has_access(self, resource: Resource, user: User):
        if not await self.check_resource_access(resource, user):
             raise HTTPException(status_code=403, detail="Access denied")

    async def check_write_access(self, resource: Resource, user: User) -> bool:
        if resource.owner_id == user.id:
            return True
            
        # Recursive check for permissions
        # If I have 'editor' (or any write? currently simplified to just shared=access for the user request)
        # The user request implies "enable all operations in shared folders".
        # Assuming all shared users are editors for simplicity or checking logic.
        # Let's check direct share first
        for perm in resource.shared_with:
            if perm.user_id == user.id:
                # STRICT check: must be explicitly 'editor'
                return perm.type == 'editor'
        
        # Check parent recursion for inherited access
        if resource.parent_id:
            parent = await Resource.get(resource.parent_id)
            if parent:
                return await self.check_write_access(parent, user)
                
        return False

    async def verify_write_access(self, resource: Resource, user: User):
        if not await self.check_write_access(resource, user):
            raise HTTPException(status_code=403, detail="Write access denied")

    async def verify_owner(self, resource: Resource, user: User):
        if resource.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Only owner can perform this action")

permission_service = PermissionService()
