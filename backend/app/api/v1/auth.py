from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.user import UserCreate, UserResponse, UserBase
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=dict)
async def register(user_in: UserCreate):
    # Check if user exists
    if await User.find_one(User.username == user_in.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create Root Folder
    root_folder = Resource(
        name="My Drive",
        type=ResourceType.FOLDER,
        owner_id=None # Will update after user creation, or user ID needed first. 
        # Actually in MongoDB we can generate ID client side or let it gen.
        # But User needs root_id, Resource needs owner_id. Circular dependency if we strictly enforce it.
        # Let's create User first (without root_id), then Root Folder (with owner_id), then update User.
    )
    # Wait, simple flow:
    # 1. Create User object (unsaved) to get ID? No, ID is generated on save usually unless specified.
    # Beanie uses ObjectId by default.
    
    # Better flow:
    # 1. Create Root Folder (owner_id=None initially or placeholder?)
    #    Actually, we can't create root folder without owner_id if we enforce it.
    #    Let's make owner_id optional? No, it should be there.
    #    We can generate a PydanticObjectId locally.
    from beanie import PydanticObjectId
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

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await User.find_one(User.username == form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(subject=user.username)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
