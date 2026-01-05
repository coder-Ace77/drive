from sqlalchemy.orm import Session
from main import SessionLocal, User, Resource, Hierarchy
import uuid

def seed_data():
    db = SessionLocal()
    
    # 1. Create a Root Folder for the user
    root_folder = Resource(
        id=uuid.uuid4(),
        name="My Drive",
        type="folder",
        s3_key=None  # Folders don't live on S3
    )
    db.add(root_folder)
    db.flush() # Get the ID of the folder

    # 2. Create the User and link them to this root
    new_user = User(
        username="adil_user",
        root_id=root_folder.id
    )
    db.add(new_user)
    
    # 3. Add the root folder to the hierarchy (Parent is NULL for root)
    root_hierarchy = Hierarchy(
        resource_id=root_folder.id,
        parent_id=None
    )
    db.add(root_hierarchy)
    
    db.commit()
    print(f"✅ User Created! User ID: {new_user.id} | Root Folder ID: {root_folder.id}")
    db.close()

if __name__ == "__main__":
    seed_data()