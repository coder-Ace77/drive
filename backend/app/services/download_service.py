from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from beanie import PydanticObjectId
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.services.s3_service import s3_service
from app.services.permission_service import permission_service
from jose import jwt, JWTError
from app.core.config import get_settings
import zipstream

class DownloadService:
    def __init__(self):
        self.settings = get_settings()

    async def get_user_from_token(self, token: str) -> User:
        try:
            payload = jwt.decode(token, self.settings.secret_key, algorithms=[self.settings.algorithm])
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(status_code=401, detail="Invalid token")
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await User.find_one(User.username == username)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    async def get_download_link(self, resource_id: PydanticObjectId, disposition: str, current_user: User, auth_token: str = None, base_url: str = None) -> dict:
        resource = await Resource.get(resource_id)
        if not resource:
            raise HTTPException(status_code=404, detail="File not found")
    
        await permission_service.verify_has_access(resource, current_user)
            
        if resource.type == ResourceType.FOLDER:
            if not auth_token:
                 raise HTTPException(status_code=401, detail="Unauthorized")
            
            download_url = f"{base_url}/api/v1/download/zip/{resource.id}?token={auth_token}"
            return {"url": download_url}
            
        if resource.type != ResourceType.FILE and resource.type != ResourceType.FOLDER:
            raise HTTPException(status_code=400, detail="Invalid resource type")
            
        if not resource.s3_key:
            raise HTTPException(status_code=404, detail="File content not found")
    
        url = s3_service.generate_presigned_download_url(resource.s3_key, disposition)
        return {"url": url}

    async def _collect_files_for_zip(self, resource_id: PydanticObjectId) -> List[tuple]:
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
        return files_to_zip

    async def stream_folder_zip(self, resource_id: PydanticObjectId, token: str) -> StreamingResponse:
        current_user = await self.get_user_from_token(token)
        resource = await Resource.get(resource_id)
        
        if not resource:
            raise HTTPException(status_code=404, detail="Not found")

        await permission_service.verify_has_access(resource, current_user)
            
        if resource.type != ResourceType.FOLDER:
            raise HTTPException(status_code=400, detail="Not a folder")
    
        files_to_zip = await self._collect_files_for_zip(resource_id)
    
        if not files_to_zip:
            raise HTTPException(status_code=404, detail="Folder is empty")
    
        zip_filename = f"{resource.name}.zip"
        
        def iter_zip():
            zs = zipstream.ZipStream(compress_type=zipstream.ZIP_DEFLATED)
            
            for s3_key, rel_path in files_to_zip:
                file_stream = s3_service.get_object_stream(s3_key)
                zs.add(file_stream, arcname=rel_path)
            yield from zs

        return StreamingResponse(
            iter_zip(), 
            media_type="application/zip", 
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )

download_service = DownloadService()
