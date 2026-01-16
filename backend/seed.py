import asyncio
from app.core.database import init_db
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.core.security import get_password_hash
from beanie import PydanticObjectId

async def seed_data():
    await init_db()
    
    # Check if user exists
    if await User.find_one(User.username == "adil_user"):
        print("User already exists.")
        return

    # 1. Create Root Folder (need an ID first if we want strict, or just create it)
    # Beanie handles IDs.
    root_folder = Resource(
        name="My Drive",
        type=ResourceType.FOLDER,
        owner_id=PydanticObjectId() # Temporary owner ID, will replace.
    )
    # Actually, let's generate the user ID first
    user_id = PydanticObjectId()
    root_folder.owner_id = user_id
    
    await root_folder.create()

    # 2. Create User
    new_user = User(
        id=user_id,
        username="adil_user",
        hashed_password=get_password_hash("password123"),
        root_id=root_folder.id
    )
    await new_user.create()
    
    print(f"✅ User Created! User ID: {new_user.id} | Root Folder ID: {root_folder.id}")

if __name__ == "__main__":
    asyncio.run(seed_data())