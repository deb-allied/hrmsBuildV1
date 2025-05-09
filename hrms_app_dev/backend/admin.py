from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import (
    get_current_active_admin,
    get_current_active_superadmin,
    get_password_hash,
)
from app.db.base import get_db
from app.logger import logger
from app.models.models import Office, User, UserLoginHistory, AttendanceRecord
from app.schemas.schemas import (
    AdminUserCreate,
    AdminUserUpdate,
    LoginHistory,
    OfficeCreate,
    OfficeUpdate,
    UserExtended,
)

router = APIRouter()


# User Management Endpoints (Admin only)
@router.get("/users", response_model=List[UserExtended])
def get_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Get all users (admin only).
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        current_admin: Current authenticated admin user
    
    Returns:
        List of users
    """
    users = db.query(User).offset(skip).limit(limit).all()
    logger.info("Admin %s retrieved user list (%d users)", current_admin.username, len(users))
    return users


@router.post("/users", response_model=UserExtended)
def create_user(
    *,
    db: Session = Depends(get_db),
    user_in: AdminUserCreate,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Create a new user (admin only).
    
    Args:
        db: Database session
        user_in: User creation data
        current_admin: Current authenticated admin user
    
    Returns:
        Created user
    
    Raises:
        HTTPException: If user already exists or insufficient permissions
    """
    # Check if trying to create an admin without super admin privileges
    if user_in.is_admin and not current_admin.is_super_admin:
        logger.warning(
            "Non-super admin %s attempted to create admin user", 
            current_admin.username
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can create admin users",
        )
    
    # Check if user already exists
    user = db.query(User).filter(
        (User.email == user_in.email) | (User.username == user_in.username)
    ).first()
    
    if user:
        logger.warning(
            "Admin %s attempted to create user with existing email %s or username %s",
            current_admin.username, user_in.email, user_in.username
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered",
        )

    # Create new user
    db_user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=user_in.is_active,
        is_admin=user_in.is_admin,
        is_super_admin=False,  # Only manually set in database for first super admin
        created_by=current_admin.id,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info(
        "Admin %s created user %s (admin: %s)", 
        current_admin.username, db_user.username, db_user.is_admin
    )
    return db_user


@router.get("/users/{user_id}", response_model=UserExtended)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Get a specific user (admin only).
    
    Args:
        user_id: ID of the user
        db: Database session
        current_admin: Current authenticated admin user
    
    Returns:
        User details
    
    Raises:
        HTTPException: If user not found
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        logger.warning("Admin %s attempted to get non-existent user ID %d", current_admin.username, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    
    logger.info("Admin %s retrieved user %s", current_admin.username, user.username)
    return user


@router.put("/users/{user_id}", response_model=UserExtended)
def update_user(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    user_in: AdminUserUpdate,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Update a user (admin only).
    
    Args:
        db: Database session
        user_id: ID of the user
        user_in: User update data
        current_admin: Current authenticated admin user
    
    Returns:
        Updated user
    
    Raises:
        HTTPException: If user not found or insufficient permissions
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        logger.warning("Admin %s attempted to update non-existent user ID %d", current_admin.username, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    
    # Check permission for changing admin status
    if user_in.is_admin is not None and user_in.is_admin != user.is_admin:
        if not current_admin.is_super_admin:
            logger.warning(
                "Non-super admin %s attempted to change admin status of user %s", 
                current_admin.username, user.username
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can change admin status",
            )
    
    # Update user fields
    update_data = user_in.dict(exclude_unset=True)
    
    # Handle password update
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info("Admin %s updated user %s", current_admin.username, user.username)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    current_admin: User = Depends(get_current_active_admin),
) -> None:
    """Delete a user (admin only).
    
    Args:
        db: Database session
        user_id: ID of the user
        current_admin: Current authenticated admin user
    
    Raises:
        HTTPException: If user not found or is the current admin
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        logger.warning("Admin %s attempted to delete non-existent user ID %d", current_admin.username, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    
    # Prevent admin from deleting themselves
    if user.id == current_admin.id:
        logger.warning("Admin %s attempted to delete themselves", current_admin.username)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    
    # Prevent non-super admin from deleting an admin
    if user.is_admin and not current_admin.is_super_admin:
        logger.warning(
            "Non-super admin %s attempted to delete admin user %s", 
            current_admin.username, user.username
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can delete admin users",
        )
    
    db.delete(user)
    db.commit()
    
    logger.info("Admin %s deleted user %s", current_admin.username, user.username)


# Login History Endpoints
@router.get("/login-history", response_model=List[LoginHistory])
def get_login_history(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Get login history (admin only).
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        user_id: Filter by user ID (optional)
        current_admin: Current authenticated admin user
    
    Returns:
        List of login history records
    """
    query = db.query(UserLoginHistory)
    
    if user_id:
        query = query.filter(UserLoginHistory.user_id == user_id)
    
    records = query.order_by(UserLoginHistory.login_time.desc()).offset(skip).limit(limit).all()
    
    logger.info(
        "Admin %s retrieved login history (%d records)%s", 
        current_admin.username, 
        len(records),
        f" for user ID {user_id}" if user_id else ""
    )
    
    return records


# Dashboard Stats Endpoint
@router.get("/dashboard-stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Get dashboard statistics (admin only).
    
    Args:
        db: Database session
        current_admin: Current authenticated admin user
    
    Returns:
        Dashboard statistics
    """
    # Count total users
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admin_users = db.query(User).filter(User.is_admin == True).count()
    
    # Count offices
    total_offices = db.query(Office).count()
    
    # Count today's attendance
    today = datetime.now().date()
    today_attendance = db.query(AttendanceRecord).filter(
        AttendanceRecord.check_in_time >= today
    ).count()
    
    # Count active logins
    active_logins = db.query(UserLoginHistory).filter(
        UserLoginHistory.logout_time.is_(None)
    ).count()
    
    # Count today's logins
    today_logins = db.query(UserLoginHistory).filter(
        UserLoginHistory.login_time >= today
    ).count()
    
    stats = {
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admin_users
        },
        "offices": {
            "total": total_offices
        },
        "attendance": {
            "today": today_attendance
        },
        "logins": {
            "active": active_logins,
            "today": today_logins
        }
    }
    
    logger.info("Admin %s retrieved dashboard stats", current_admin.username)
    return stats
