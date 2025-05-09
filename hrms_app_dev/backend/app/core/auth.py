from datetime import datetime, timedelta
from typing import Any, Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from ldap3 import Server, Connection, ALL, SUBTREE
from ldap3.core.exceptions import LDAPException, LDAPBindError

from app.config import settings
from app.db.base import get_db
from app.logger import logger
from app.models.models import User
from app.schemas.schemas import TokenPayload

# Security settings
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def global_ldap_authentication(user_name, user_pwd):
    """
      Function: global_ldap_authentication
       Purpose: Make a connection to encrypted LDAP server.
       :params: ** Mandatory Positional Parameters
                1. user_name - LDAP user Name
                2. user_pwd - LDAP User Password
       :return: None
    """

    # fetch the username and password
    ldap_user_name = user_name.strip()
    ldap_user_pwd = user_pwd.strip()

    # ldap server hostname and port
    ldsp_server = f"LDAP://corp.alliedworldwide.com"

    # dn
    root_dn = "dc=alliedworldwide,dc=org"

    # user
    user = f'cn={ldap_user_name},{root_dn}'

    print(user)
    server = Server(ldsp_server, get_info=ALL)

    connection = Connection(server,
                            user=user,
                            password=ldap_user_pwd)
    if not connection.bind():
        print(f" *** Cannot bind to ldap server: {connection.last_error} ")
        l_success_msg = f' ** Failed Authentication: {connection.last_error}'
    else:
        print(f" *** Successful bind to ldap server")
        l_success_msg = 'Success'

    return l_success_msg

# JWT token functions
def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token.
    
    Args:
        subject: Token subject (typically user ID)
        expires_delta: Optional expiration time delta
    
    Returns:
        JWT token string
    """
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password
    
    Returns:
        Whether the password matches the hash
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password.
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password
    """
    return pwd_context.hash(password)


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """Get the current authenticated user.
    
    Args:
        db: Database session
        token: JWT token
    
    Returns:
        User object
    
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        token_data = TokenPayload(**payload)
        
        # Convert the exp timestamp to datetime for comparison
        if datetime.fromtimestamp(token_data.exp) < datetime.now():
            logger.warning("Token expired for subject: %s", token_data.sub)
            raise credentials_exception
            
    except JWTError as e:
        logger.error("JWT error: %s", str(e))
        raise credentials_exception
    
    user = db.query(User).filter(User.id == token_data.sub).first()
    
    if user is None:
        logger.warning("User not found for token subject: %s", token_data.sub)
        raise credentials_exception
        
    if not user.is_active:
        logger.warning("Inactive user attempted login: %s", user.username)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
        
    logger.info("User authenticated: %s", user.username)
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active authenticated user.
    
    Args:
        current_user: Current user from token
    
    Returns:
        User object if active
    
    Raises:
        HTTPException: If user is inactive
    """
    if not current_user.is_active:
        logger.warning("Inactive user attempted access: %s", current_user.username)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return current_user


def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active admin user.
    
    Args:
        current_user: Current user from token
    
    Returns:
        User object if active and admin
    
    Raises:
        HTTPException: If user is not an admin
    """
    if not current_user.is_admin and not current_user.is_super_admin:
        logger.warning("Non-admin user attempted admin action: %s", current_user.username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return current_user


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