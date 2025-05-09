from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_admin, get_current_active_user
from app.db.base import get_db
from app.logger import logger
from app.models.models import Office, User
from app.schemas.schemas import Office as OfficeSchema, OfficeCreate, OfficeUpdate

router = APIRouter()


@router.get("/", response_model=List[OfficeSchema])
def read_offices(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retrieve all offices.
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        current_user: Current authenticated user
    
    Returns:
        List of offices
    """
    offices = db.query(Office).order_by(Office.id).offset(skip).limit(limit).all()
    logger.info("Retrieved %d offices", len(offices))
    return offices


@router.post("/", response_model=OfficeSchema)
def create_office(
    *,
    db: Session = Depends(get_db),
    office_in: OfficeCreate,
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """Create a new office with geofence.
    
    Args:
        db: Database session
        office_in: Office creation data
        current_user: Current authenticated admin user
    
    Returns:
        Created office
    """
    office = Office(
        name=office_in.name,
        address=office_in.address,
        latitude=office_in.latitude,
        longitude=office_in.longitude,
        radius=office_in.radius,
    )
    
    db.add(office)
    db.commit()
    db.refresh(office)
    
    logger.info(
        "Office created: %s at (%f, %f) with radius %f meters", 
        office.name, office.latitude, office.longitude, office.radius
    )
    return office


@router.get("/{office_id}", response_model=OfficeSchema)
def read_office(
    office_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get a specific office by ID.
    
    Args:
        office_id: ID of the office
        db: Database session
        current_user: Current authenticated user
    
    Returns:
        Office data
    
    Raises:
        HTTPException: If office not found
    """
    office = db.query(Office).filter(Office.id == office_id).first()
    
    if not office:
        logger.warning("Office not found: ID %d", office_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Office not found"
        )
        
    logger.info("Retrieved office: %s (ID: %d)", office.name, office.id)
    return office


@router.put("/{office_id}", response_model=OfficeSchema)
def update_office(
    *,
    db: Session = Depends(get_db),
    office_id: int,
    office_in: OfficeUpdate,
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """Update an office.
    
    Args:
        db: Database session
        office_id: ID of the office to update
        office_in: Office update data
        current_user: Current authenticated admin user
    
    Returns:
        Updated office
    
    Raises:
        HTTPException: If office not found
    """
    office = db.query(Office).filter(Office.id == office_id).first()
    
    if not office:
        logger.warning("Office not found for update: ID %d", office_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Office not found"
        )
    
    # Update office fields
    update_data = office_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(office, field, value)
    
    db.add(office)
    db.commit()
    db.refresh(office)
    
    logger.info("Office updated: %s (ID: %d)", office.name, office.id)
    return office


@router.delete("/{office_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_office(
    *,
    db: Session = Depends(get_db),
    office_id: int,
    current_user: User = Depends(get_current_active_admin),
) -> None:
    """Delete an office.
    
    Args:
        db: Database session
        office_id: ID of the office to delete
        current_user: Current authenticated admin user
    
    Raises:
        HTTPException: If office not found
    """
    office = db.query(Office).filter(Office.id == office_id).first()
    
    if not office:
        logger.warning("Office not found for deletion: ID %d", office_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Office not found"
        )
    
    db.delete(office)
    db.commit()
    
    logger.info("Office deleted: %s (ID: %d)", office.name, office.id)