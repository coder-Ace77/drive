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
        for perm in resource.shared_with:
            if perm.user_id == user.id:
                return perm.type == 'editor'
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
