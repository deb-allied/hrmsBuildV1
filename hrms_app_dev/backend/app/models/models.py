from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Enum as SQLAlchemyEnum, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    """User model for authentication and tracking."""
    
    __tablename__ = "hrms_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_super_admin = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("hrms_users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    attendance_records = relationship("AttendanceRecord", back_populates="user")
    created_users = relationship("User", backref="creator", remote_side=[id])
    login_history = relationship("UserLoginHistory", back_populates="user")
    home_addresses = relationship("UserHomeAddress", back_populates="user") 
    
    def __repr__(self):
        return f"<User {self.username}>"

class UserHomeAddress(Base):
    """Home addresses for users with a limit of 2 addresses per user."""
    
    __tablename__ = "hrms_user_home_addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("hrms_users.id"), nullable=False)
    address_type = Column(String(50), nullable=False)  # 'primary' or 'secondary'
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_current = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationship with User model
    user = relationship("User", back_populates="home_addresses")
    attendance_records = relationship("AttendanceRecord", back_populates="home_address")
    
    # Constraint to limit addresses to primary and secondary only (max 2 per user)
    __table_args__ = (
        UniqueConstraint('user_id', 'address_type', name='uix_user_address_type'),
    )
    
    def __repr__(self):
        return f"<UserHomeAddress {self.id} - User: {self.user_id} - Type: {self.address_type}>"
    
class UserLoginHistory(Base):
    """Track user login/logout activity."""
    
    __tablename__ = "hrms_user_login_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("hrms_users.id"), nullable=False)
    login_time = Column(DateTime, nullable=False, default=datetime.now)
    logout_time = Column(DateTime, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(512), nullable=True)
    
    user = relationship("User", back_populates="login_history")
    
    def __repr__(self):
        status = "Active" if self.logout_time is None else "Completed"
        return f"<LoginSession {self.id} - User: {self.user_id} - Status: {status}>"


class Office(Base):
    """Office location with geofence coordinates."""
    
    __tablename__ = "hrms_offices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    attendance_records = relationship("AttendanceRecord", back_populates="office")
    
    def __repr__(self):
        return f"<Office {self.name} ({self.latitude}, {self.longitude})>"


class LocationType(str, Enum):
    """Enum for different location types for attendance."""
    OFFICE = "office"
    HOME = "home" 
    OTHER = "other"


class AttendanceRecord(Base):
    """Records of check-ins and check-outs for attendance tracking."""
    
    __tablename__ = "hrms_attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("hrms_users.id"), nullable=False)
    
    # Location information - both are optional now
    office_id = Column(Integer, ForeignKey("hrms_offices.id"), nullable=True)
    home_address_id = Column(Integer, ForeignKey("hrms_user_home_addresses.id"), nullable=True)
    
    # New field to track the type of location
    location_type = Column(SQLAlchemyEnum(LocationType), nullable=False)
    
    check_in_time = Column(DateTime, nullable=False, default=datetime.now)
    check_out_time = Column(DateTime, nullable=True)
    check_in_latitude = Column(Float, nullable=False)
    check_in_longitude = Column(Float, nullable=False)
    check_out_latitude = Column(Float, nullable=True)
    check_out_longitude = Column(Float, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="attendance_records")
    office = relationship("Office", back_populates="attendance_records")
    home_address = relationship("UserHomeAddress", back_populates="attendance_records")
    
    def __repr__(self):
        status = "Active" if self.check_out_time is None else "Completed"
        location = f"{self.location_type.value}"
        return f"<AttendanceRecord {self.id} - User: {self.user_id} - Location: {location} - Status: {status}>"