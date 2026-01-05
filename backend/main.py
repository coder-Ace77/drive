import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import boto3
from botocore.config import Config
from fastapi import FastAPI, HTTPException, Depends, status , Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, Column, String, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
import os
from fastapi.middleware.cors import CORSMiddleware
# --- 1. CONFIGURATION ---
class Settings(BaseSettings):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket_name: str
    database_url: str
    secret_key: str  # Use a long random string
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()

# Security Setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- 2. DATABASE MODELS ---
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    root_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"))

class Resource(Base):
    __tablename__ = "resources"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    type = Column(String)  # 'file' or 'folder'
    s3_key = Column(Text, nullable=True)

class Hierarchy(Base):
    __tablename__ = "hierarchy"
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), primary_key=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- 3. AUTH UTILITIES ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None: raise credentials_exception
    return user

# --- 4. S3 CLIENT & APP ---
app = FastAPI(title="Recursive S3 Drive")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Your React URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_region,
    config=Config(signature_version='s3v4')
)

# --- 5. ENDPOINTS ---

# A. AUTHENTICATION
@app.post("/register")
async def register(username: str, password: str, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # 1. Create Root Folder for the User
    root_folder_id = uuid.uuid4()
    root_folder = Resource(id=root_folder_id, name="My Drive", type="folder")
    db.add(root_folder)
    
    # --- ADD THIS LINE ---
    db.flush() # This tells the DB "Here is the resource" without finishing the transaction
    # ---------------------

    # 2. Link Root Folder in Hierarchy
    db.add(Hierarchy(resource_id=root_folder_id, parent_id=None))
    
    # 3. Create User
    new_user = User(
        username=username,
        hashed_password=pwd_context.hash(password),
        root_id=root_folder_id
    )
    db.add(new_user)
    
    db.commit() # Now save everything for real
    return {"message": "User registered successfully", "root_id": root_folder_id}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

# B. DIRECTORY MANAGEMENT
@app.post("/folders")
async def create_folder(
    name: str, 
    parent_id: uuid.UUID, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    folder_id = uuid.uuid4()
    # 1. Add the Resource
    db.add(Resource(id=folder_id, name=name, type="folder"))
    
    # 2. FLUSH to ensure Resource exists in the DB session
    db.flush() 
    
    # 3. Add the Link
    db.add(Hierarchy(resource_id=folder_id, parent_id=parent_id))
    db.commit()
    return {"id": folder_id, "name": name}

@app.get("/tree")
async def get_tree(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = text("""
        WITH RECURSIVE resource_tree AS (
            SELECT r.id, r.name, r.type, h.parent_id
            FROM resources r
            JOIN hierarchy h ON r.id = h.resource_id
            WHERE r.id = :root_id
          UNION ALL
            SELECT r.id, r.name, r.type, h.parent_id
            FROM resources r
            JOIN hierarchy h ON r.id = h.resource_id
            JOIN resource_tree rt ON h.parent_id = rt.id
        )
        SELECT * FROM resource_tree;
    """)
    result = db.execute(query, {"root_id": current_user.root_id}).fetchall()
    return {"tree": [dict(row._mapping) for row in result]}

@app.get("/folders/{folder_id}")
async def get_folder_contents(
    folder_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Query to join Resource and Hierarchy to get files in this folder
    # We filter by parent_id to see what is "inside" the folder
    items = db.query(Resource).join(
        Hierarchy, Resource.id == Hierarchy.resource_id
    ).filter(
        Hierarchy.parent_id == folder_id
    ).all()

    # Convert SQLAlchemy models to a list of dicts for the frontend
    children = []
    for item in items:
        children.append({
            "id": str(item.id),
            "name": item.name,
            "type": item.type, # "file" or "folder"
            "s3_key": item.s3_key,
            "created_at": item.created_at if hasattr(item, 'created_at') else None
        })

    return {"children": children}

@app.post("/upload")
async def get_upload_url(
    parent_id: uuid.UUID, 
    file_name: str, 
    file_type: str,
    relative_path: str = Query(None), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        target_parent_id = parent_id

        if relative_path and "/" in relative_path:
            path_segments = relative_path.split("/")[:-1] 
            
            for segment in path_segments:
                existing_folder = db.query(Resource).join(
                    Hierarchy, Resource.id == Hierarchy.resource_id
                ).filter(
                    Hierarchy.parent_id == target_parent_id,
                    Resource.name == segment,
                    Resource.type == "folder"
                ).first()

                if existing_folder:
                    target_parent_id = existing_folder.id
                else:
                    new_folder_id = uuid.uuid4()
                    new_folder = Resource(
                        id=new_folder_id,
                        name=segment,
                        type="folder"
                    )
                    db.add(new_folder)
                    db.flush() 
                    
                    db.add(Hierarchy(resource_id=new_folder_id, parent_id=target_parent_id))
                    db.flush()
                    
                    target_parent_id = new_folder_id

        resource_id = uuid.uuid4()
        s3_key = f"{current_user.id}/{resource_id}/{file_name}"
        
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.s3_bucket_name, 
                'Key': s3_key, 
                'ContentType': file_type
            },
            ExpiresIn=3600
        )
        
        db.commit()
        return {
            "url": url, 
            "resource_id": str(resource_id), 
            "s3_key": s3_key,
            "actual_parent_id": str(target_parent_id) 
        }

    except Exception as e:
        db.rollback()
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error during upload prep")

@app.post("/upload/done")
async def confirm_upload(
    resource_id: uuid.UUID, 
    parent_id: uuid.UUID, 
    name: str, 
    s3_key: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Add the File Resource
    db.add(Resource(id=resource_id, name=name, type="file", s3_key=s3_key))
    
    # 2. FLUSH here too!
    db.flush()
    
    # 3. Add the Link
    db.add(Hierarchy(resource_id=resource_id, parent_id=parent_id))
    db.commit()
    return {"status": "indexed", "resource_id": resource_id}

# --- backend/main.py ---

@app.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently logged-in user's info, 
    including their root folder ID.
    """
    return {
        "username": current_user.username,
        "root_id": str(current_user.root_id)
    }

@app.delete("/delete/{resource_id}")
async def delete_resource(
    resource_id: uuid.UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource: raise HTTPException(status_code=404, detail="Not found")

    if resource.s3_key:
        s3_client.delete_object(Bucket=settings.s3_bucket_name, Key=resource.s3_key)

    db.query(Hierarchy).filter(Hierarchy.resource_id == resource_id).delete()
    db.delete(resource)
    db.commit()
    return {"message": "Deleted"}