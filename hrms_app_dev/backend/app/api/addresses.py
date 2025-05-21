from typing import Any, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.db.base import get_db
from app.logger import logger
from app.models.models import UserHomeAddress, User
from app.schemas.schemas import (
    UserHomeAddress as UserHomeAddressSchema,
    UserHomeAddressCreate,
    UserHomeAddressUpdate,
)

router = APIRouter()


@router.get("/", response_model=List[UserHomeAddressSchema])
def read_home_addresses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retrieve all home addresses for the current user.
    
    Args:
        db: Database session
        current_user: Current authenticated user
    
    Returns:
        List of user's home addresses
    """
    addresses = db.query(UserHomeAddress).filter(
        UserHomeAddress.user_id == current_user.id
    ).all()
    
    logger.info("User %s retrieved their %d home addresses", current_user.username, len(addresses))
    return addresses


@router.post("/", response_model=UserHomeAddressSchema)
def create_home_address(
    *,
    db: Session = Depends(get_db),
    address_in: UserHomeAddressCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a new home address for the current user.
    
    Args:
        db: Database session
        address_in: Home address creation data
        current_user: Current authenticated user
    
    Returns:
        Created home address
    
    Raises:
        HTTPException: If address type limit reached
    """
    # Check if the user already has this address type
    existing_address = db.query(UserHomeAddress).filter(
        UserHomeAddress.user_id == current_user.id,
        UserHomeAddress.address_type == address_in.address_type
    ).first()
    
    if existing_address:
        logger.warning(
            "User %s attempted to create duplicate %s address", 
            current_user.username, address_in.address_type
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a {address_in.address_type} address",
        )
    
    # Check how many addresses the user has
    address_count = db.query(UserHomeAddress).filter(
        UserHomeAddress.user_id == current_user.id
    ).count()
    
    if address_count >= 2:
        logger.warning(
            "User %s attempted to create more than 2 addresses", 
            current_user.username
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only have up to 2 home addresses",
        )
    
    # Create new address
    db_address = UserHomeAddress(
        user_id=current_user.id,
        address_type=address_in.address_type,
        address_line1=address_in.address_line1,
        address_line2=address_in.address_line2,
        city=address_in.city,
        state=address_in.state,
        country=address_in.country,
        postal_code=address_in.postal_code,
        latitude=address_in.latitude,
        longitude=address_in.longitude,
        is_current=address_in.is_current,
    )
    
    db.add(db_address)
    db.commit()
    db.refresh(db_address)
    
    logger.info(
        "User %s created a new %s home address (ID: %d)", 
        current_user.username, address_in.address_type, db_address.id
    )
    return db_address


@router.get("/{address_id}", response_model=UserHomeAddressSchema)
def read_home_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get a specific home address by ID.
    
    Args:
        address_id: ID of the address
        db: Database session
        current_user: Current authenticated user
    
    Returns:
        Home address data
    
    Raises:
        HTTPException: If address not found or does not belong to user
    """
    address = db.query(UserHomeAddress).filter(
        UserHomeAddress.id == address_id,
        UserHomeAddress.user_id == current_user.id
    ).first()
    
    if not address:
        logger.warning("User %s tried to access non-existent/unauthorized address ID %d", 
                     current_user.username, address_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Address not found"
        )
        
    logger.info("User %s retrieved their %s home address (ID: %d)", 
               current_user.username, address.address_type, address.id)
    return address


@router.put("/{address_id}", response_model=UserHomeAddressSchema)
def update_home_address(
    *,
    db: Session = Depends(get_db),
    address_id: int,
    address_in: UserHomeAddressUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update a home address.
    
    Args:
        db: Database session
        address_id: ID of the address to update
        address_in: Home address update data
        current_user: Current authenticated user
    
    Returns:
        Updated home address
    
    Raises:
        HTTPException: If address not found or does not belong to user
    """
    address = db.query(UserHomeAddress).filter(
        UserHomeAddress.id == address_id,
        UserHomeAddress.user_id == current_user.id
    ).first()
    
    if not address:
        logger.warning("User %s tried to update non-existent/unauthorized address ID %d", 
                     current_user.username, address_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Address not found"
        )
    
    # Check if changing address type will create a duplicate
    if address_in.address_type and address_in.address_type != address.address_type:
        existing_address = db.query(UserHomeAddress).filter(
            UserHomeAddress.user_id == current_user.id,
            UserHomeAddress.address_type == address_in.address_type,
            UserHomeAddress.id != address_id
        ).first()
        
        if existing_address:
            logger.warning(
                "User %s attempted to create duplicate %s address", 
                current_user.username, address_in.address_type
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a {address_in.address_type} address",
            )
    
    # Update address fields
    update_data = address_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(address, field, value)
    
    # Update the updated_at timestamp
    address.updated_at = datetime.now()
    
    db.add(address)
    db.commit()
    db.refresh(address)
    
    logger.info("User %s updated their %s home address (ID: %d)", 
               current_user.username, address.address_type, address.id)
    return address


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_home_address(
    *,
    db: Session = Depends(get_db),
    address_id: int,
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a home address.
    
    Args:
        db: Database session
        address_id: ID of the address to delete
        current_user: Current authenticated user
    
    Raises:
        HTTPException: If address not found or does not belong to user
    """
    address = db.query(UserHomeAddress).filter(
        UserHomeAddress.id == address_id,
        UserHomeAddress.user_id == current_user.id
    ).first()
    
    if not address:
        logger.warning("User %s tried to delete non-existent/unauthorized address ID %d", 
                     current_user.username, address_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Address not found"
        )
    
    db.delete(address)
    db.commit()
    
    logger.info("User %s deleted their %s home address (ID: %d)", 
               current_user.username, address.address_type, address.id)