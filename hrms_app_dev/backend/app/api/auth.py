from datetime import datetime, timedelta
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.core.auth import (
    create_access_token,
    get_current_active_user,
    get_password_hash,
    verify_password,
    get_current_user,
    get_current_active_admin
)
from app.db.base import get_db
from app.core.ldap import LDAPAuth
from app.logger import logger
from app.models.models import User, UserLoginHistory
from app.schemas.schemas import Token, User as UserSchema, UserCreate, LoginHistory

router = APIRouter()


@router.post("/register", response_model=UserSchema)
def register_user(*, db: Session = Depends(get_db), user_in: UserCreate) -> Any:
    """Register a new user.
    
    Args:
        db: Database session
        user_in: User creation data
    
    Returns:
        Created user
    
    Raises:
        HTTPException: If user already exists
    """
    # Check if user already exists
    user = db.query(User).filter(
        (User.email == user_in.email) | (User.username == user_in.username)
    ).first()
    
    if user:
        logger.warning(
            "Registration failed: User with email %s or username %s already exists",
            user_in.email, user_in.username
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
        is_active=True,
        is_admin=False,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info("User registered successfully: %s", db_user.username)
    return db_user


@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: User = Depends(get_current_active_user)) -> Any:
    """Get current user information.
    
    Args:
        current_user: Current authenticated user
    
    Returns:
        Current user data
    """
    return current_user

# Add this dependency to auth.py
def get_current_active_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active super admin user.
    
    Args:
        current_user: Current user from token
    
    Returns:
        User object if active and super admin
    
    Raises:
        HTTPException: If user is not a super admin
    """
    if not current_user.is_super_admin:
        logger.warning("Non-super admin user attempted super admin action: %s", current_user.username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super admin privileges required"
        )
    return current_user

# Add this to app/api/auth.py
def create_user_from_ldap(
    db: Session, 
    username: str, 
    ldap_user_info: Dict[str, Any]
) -> User:
    """
    Create a new user from LDAP authentication info.
    
    Args:
        db: Database session
        username: Username from LDAP
        ldap_user_info: User information retrieved from LDAP
        
    Returns:
        Created user object
    """
    # Extract email from LDAP or create a default one
    email = ldap_user_info.get('email', f"{username}@example.com")
    
    # Create new user with a placeholder password (actual auth is via LDAP)
    db_user = User(
        email=email,
        username=username,
        hashed_password="LDAP_AUTHENTICATED_USER",  # Placeholder
        full_name=ldap_user_info.get('full_name', username),
        is_active=True,
        is_admin=LDAPAuth.is_admin(ldap_user_info.get('groups', [])),
        is_super_admin=LDAPAuth.is_super_admin(ldap_user_info.get('groups', []))
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info("User created from LDAP authentication: %s", username)
    return db_user

# Modified login_for_access_token in app/api/auth.py
@router.post("/login", response_model=Token)
def login_for_access_token(
    request: Request,
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """Login and get access token using LDAP authentication.
    
    Args:
        request: Request object to get client info
        db: Database session
        form_data: Login form data
    
    Returns:
        Access token
    
    Raises:
        HTTPException: If authentication fails
    """
    # First, try to authenticate with LDAP
    auth_successful, ldap_user_info = LDAPAuth.authenticate(
        username=form_data.username, 
        password=form_data.password
    )
    
    if not auth_successful:
        logger.warning("LDAP authentication failed for username: %s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user exists in the database
    user = db.query(User).filter(User.username == form_data.username).first()
    
    # If user doesn't exist in the database but authenticated with LDAP, create a new user
    if not user:
        logger.info("User %s authenticated via LDAP but not in database, creating account", form_data.username)
        user = create_user_from_ldap(db, form_data.username, ldap_user_info)
    else:
        # Update user information from LDAP
        if ldap_user_info.get('email'):
            user.email = ldap_user_info.get('email')
        if ldap_user_info.get('full_name'):
            user.full_name = ldap_user_info.get('full_name')
            
        # Update admin status based on LDAP groups
        user.is_admin = LDAPAuth.is_admin(ldap_user_info.get('groups', [])) or user.is_admin
        user.is_super_admin = LDAPAuth.is_super_admin(ldap_user_info.get('groups', [])) or user.is_super_admin
            
        db.add(user)
        db.commit()
    
    if not user.is_active:
        logger.warning("Login attempt by inactive user: %s", user.username)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )

    # Update last login time
    user.last_login = datetime.now()
    
    # Record login history
    client_host = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    login_record = UserLoginHistory(
        user_id=user.id,
        login_time=datetime.now(),
        ip_address=client_host,
        user_agent=user_agent
    )
    
    db.add(login_record)
    db.add(user)
    db.commit()

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    logger.info("User %s logged in successfully via LDAP", user.username)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Logout the current user.
    
    Args:
        request: Request object to get client info
        db: Database session
        current_user: Current authenticated user
    
    Returns:
        Success message
    """
    # Find active login session
    active_session = db.query(UserLoginHistory).filter(
        UserLoginHistory.user_id == current_user.id,
        UserLoginHistory.logout_time.is_(None)
    ).order_by(UserLoginHistory.login_time.desc()).first()
    
    if active_session:
        active_session.logout_time = datetime.now()
        db.add(active_session)
        db.commit()
    
    logger.info("User logged out: %s", current_user.username)
    return {"detail": "Successfully logged out"}

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