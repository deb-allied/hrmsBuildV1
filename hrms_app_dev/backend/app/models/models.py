from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
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
    
    def __repr__(self):
        return f"<User {self.username}>"


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


class AttendanceRecord(Base):
    """Records of check-ins and check-outs for attendance tracking."""
    
    __tablename__ = "hrms_attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("hrms_users.id"), nullable=False)
    office_id = Column(Integer, ForeignKey("hrms_offices.id"), nullable=False)
    check_in_time = Column(DateTime, nullable=False, default=datetime.now)
    check_out_time = Column(DateTime, nullable=True)
    check_in_latitude = Column(Float, nullable=False)
    check_in_longitude = Column(Float, nullable=False)
    check_out_latitude = Column(Float, nullable=True)
    check_out_longitude = Column(Float, nullable=True)
    
    user = relationship("User", back_populates="attendance_records")
    office = relationship("Office", back_populates="attendance_records")
    
    def __repr__(self):
        status = "Active" if self.check_out_time is None else "Completed"
        return f"<AttendanceRecord {self.id} - User: {self.user_id} - Status: {status}>"
