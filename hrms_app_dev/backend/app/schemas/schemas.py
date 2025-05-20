from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


# Enum for location types
class LocationType(str, Enum):
    """Enum for different location types for attendance."""
    OFFICE = "office"
    HOME = "home"
    OTHER = "other"


# User Home Address Schemas
class AddressType(str, Enum):
    """Enum for types of home addresses."""
    PRIMARY = "primary"
    SECONDARY = "secondary"


class UserHomeAddressBase(BaseModel):
    """Base schema for user home address data."""
    
    address_type: AddressType
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    country: str
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_current: bool = True


class UserHomeAddressCreate(UserHomeAddressBase):
    """Schema for creating a new home address."""
    
    pass


class UserHomeAddressUpdate(BaseModel):
    """Schema for updating a home address."""
    
    address_type: Optional[AddressType] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_current: Optional[bool] = None


class UserHomeAddressInDB(UserHomeAddressBase):
    """Schema for home address data as stored in DB."""
    
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class UserHomeAddress(UserHomeAddressInDB):
    """Schema for home address response data."""
    
    pass


# User Schemas
class UserBase(BaseModel):
    """Base schema for User data."""
    
    email: EmailStr
    username: str
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating a new user."""
    
    password: str
    full_name: Optional[str] = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserInDB(UserBase):
    """Schema for User data as stored in DB."""
    
    id: int
    full_name: Optional[str] = None
    is_admin: bool = False
    is_super_admin: bool = False
    created_at: datetime
    last_login: Optional[datetime] = None
    created_by: Optional[int] = None

    class Config:
        orm_mode = True


class User(UserInDB):
    """Schema for User response data."""
    
    pass


# Admin User Management Schemas
class AdminUserCreate(BaseModel):
    """Schema for admin creating a new user."""
    
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False  # Only super_admin can set this to True


class AdminUserUpdate(BaseModel):
    """Schema for admin updating a user."""
    
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None  # Only super_admin can modify this


class UserExtended(User):
    """Schema for extended User response with additional fields."""
    
    home_addresses: Optional[List[UserHomeAddress]] = []


# Office Schemas
class OfficeBase(BaseModel):
    """Base schema for Office data."""
    
    name: str
    address: str
    latitude: float
    longitude: float
    radius: float = Field(..., description="Radius of geofence in meters")


class OfficeCreate(OfficeBase):
    """Schema for creating a new office."""
    
    pass


class OfficeUpdate(BaseModel):
    """Schema for updating an office."""
    
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None


class OfficeInDB(OfficeBase):
    """Schema for Office data as stored in DB."""
    
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class Office(OfficeInDB):
    """Schema for Office response data."""
    
    pass


# Attendance Schemas
class AttendanceBase(BaseModel):
    """Base schema for Attendance data."""
    
    user_id: int
    location_type: LocationType


class CheckInCreate(BaseModel):
    """Schema for creating a check-in."""
    
    location_type: LocationType
    latitude: float
    longitude: float
    office_id: Optional[int] = None
    home_address_id: Optional[int] = None
    
    @validator('office_id')
    def validate_office_id(cls, v, values):
        if values.get('location_type') == LocationType.OFFICE and not v:
            raise ValueError('office_id is required when location_type is OFFICE')
        return v
    
    @validator('home_address_id')
    def validate_home_address_id(cls, v, values):
        if values.get('location_type') == LocationType.HOME and not v:
            raise ValueError('home_address_id is required when location_type is HOME')
        return v


class CheckOutCreate(BaseModel):
    """Schema for creating a check-out."""
    
    latitude: float
    longitude: float


class AttendanceRecord(BaseModel):
    """Schema for Attendance response data."""
    
    id: int
    user_id: int
    location_type: LocationType
    office_id: Optional[int] = None
    home_address_id: Optional[int] = None
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    check_in_latitude: float
    check_in_longitude: float
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None

    class Config:
        orm_mode = True


# Login History Schemas
class LoginHistoryBase(BaseModel):
    """Base schema for login history."""
    
    user_id: int
    login_time: datetime
    logout_time: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class LoginHistory(LoginHistoryBase):
    """Schema for login history response."""
    
    id: int
    
    class Config:
        orm_mode = True


class LoginHistoryWithUser(LoginHistory):
    """Schema for login history with user details."""
    
    user: User


# Authentication Schemas
class Token(BaseModel):
    """Schema for JWT token response."""
    
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Schema for JWT token payload."""
    
    sub: int
    exp: int  # Store as Unix timestamp


# Location Schemas
class LocationCheck(BaseModel):
    """Schema for checking if a location is within a geofence."""
    
    latitude: float
    longitude: float
    office_id: Optional[int] = None  # If not provided, check against all offices
    home_address_id: Optional[int] = None  # For checking against home address


class GeofenceStatus(BaseModel):
    """Schema for geofence status response."""
    
    is_within_geofence: bool
    location_type: Optional[LocationType] = None
    office_id: Optional[int] = None
    office_name: Optional[str] = None
    home_address_id: Optional[int] = None
    address_type: Optional[str] = None
    distance: Optional[float] = None  # Distance in meters