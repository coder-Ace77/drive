from fastapi import HTTPException
from app.schemas.user import UserCreate
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.core.security import get_password_hash, verify_password, create_access_token
from beanie import PydanticObjectId

class AuthService:
    async def register_user(self, user_in: UserCreate) -> dict:
        if await User.find_one(User.username == user_in.username):
            raise HTTPException(status_code=400, detail="Username already exists")
        
        user_id = PydanticObjectId()
        
        root_folder = Resource(
            name="My Drive",
            type=ResourceType.FOLDER,
            owner_id=user_id
        )

        await root_folder.create()
        
        hashed_pw = get_password_hash(user_in.password)
        
        new_user = User(
            id=user_id,
            username=user_in.username,
            hashed_password=hashed_pw,
            root_id=root_folder.id
        )
        await new_user.create()
        return {"message": "User registered successfully", "root_id": str(root_folder.id)}

    async def authenticate_user(self, username: str, password: str) -> dict:
        user = await User.find_one(User.username == username)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        token = create_access_token(subject=user.username)
        return {"access_token": token, "token_type": "bearer"}

auth_service = AuthService()
