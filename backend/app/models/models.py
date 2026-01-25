import uuid
from sqlalchemy import Column, String, ForeignKey, Enum, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    root_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"))

class Resource(Base):
    __tablename__ = "resources"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    type = Column(String)
    s3_key = Column(String, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

class Hierarchy(Base):
    __tablename__ = "hierarchy"
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), primary_key=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=True)

class Permission(Base):
    __tablename__ = "permissions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"))
    mode = Column(String)