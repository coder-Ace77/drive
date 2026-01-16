from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from beanie import PydanticObjectId

class User(Document):
    username: Indexed(str, unique=True)
    hashed_password: str
    root_id: Optional[PydanticObjectId] = None
    
    class Settings:
        name = "users"
