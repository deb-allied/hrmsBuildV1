from datetime import datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.geofence import GeofenceService
from app.db.base import get_db
from app.logger import logger
from app.models.models import AttendanceRecord, Office, User, UserHomeAddress
from app.schemas.schemas import (
    AttendanceRecord as AttendanceRecordSchema,
    CheckInCreate,
    CheckOutCreate,
    GeofenceStatus,
    LocationCheck,
    LocationType,
)

router = APIRouter()


@router.post("/check-location", response_model=List[GeofenceStatus])
def check_location(
    *,
    db: Session = Depends(get_db),
    location_data: LocationCheck,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Check if a location is within any geofence.
    
    Args:
        db: Database session
        location_data: Location data to check
        current_user: Current authenticated user
    
    Returns:
        List of geofence status for all offices or specific office/home
    """
    results = []
    
    # Check against office if office_id is provided
    if location_data.office_id:
        office = db.query(Office).filter(Office.id == location_data.office_id).first()
        
        if not office:
            logger.warning("Office not found for location check: ID %d", location_data.office_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Office not found"
            )
            
        status = GeofenceService.check_within_geofence(
            location_data.latitude, location_data.longitude, office
        )
        status.location_type = LocationType.OFFICE
        results.append(status)
    
    # Check against home address if home_address_id is provided
    elif location_data.home_address_id:
        home_address = db.query(UserHomeAddress).filter(
            UserHomeAddress.id == location_data.home_address_id,
            UserHomeAddress.user_id == current_user.id
        ).first()
        
        if not home_address:
            logger.warning(
                "Home address not found for location check: ID %d", 
                location_data.home_address_id
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Home address not found"
            )
            
        status = GeofenceService.check_within_home_geofence(
            location_data.latitude, location_data.longitude, home_address
        )
        status.location_type = LocationType.HOME
        status.home_address_id = home_address.id
        status.address_type = home_address.address_type
        results.append(status)
    
    # Otherwise, check against all offices and user's home addresses
    else:
        # Check all offices
        office_results = GeofenceService.check_all_geofences(
            db, location_data.latitude, location_data.longitude
        )
        for result in office_results:
            result.location_type = LocationType.OFFICE
            results.append(result)
        
        # Check user's home addresses
        home_addresses = db.query(UserHomeAddress).filter(
            UserHomeAddress.user_id == current_user.id,
            UserHomeAddress.is_current == True
        ).all()
        
        for home in home_addresses:
            if home.latitude and home.longitude:
                status = GeofenceService.check_within_home_geofence(
                    location_data.latitude, location_data.longitude, home
                )
                status.location_type = LocationType.HOME
                status.home_address_id = home.id
                status.address_type = home.address_type
                results.append(status)
    
    logger.info(
        "Location check for user %s at (%f, %f): %d locations checked",
        current_user.username, location_data.latitude, location_data.longitude, len(results)
    )
    return results


@router.post("/check-in", response_model=AttendanceRecordSchema)
def check_in(
    *,
    db: Session = Depends(get_db),
    check_in_data: CheckInCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Check in to an office or home location.
    
    Args:
        db: Database session
        check_in_data: Check-in data
        current_user: Current authenticated user
    
    Returns:
        Created attendance record
    
    Raises:
        HTTPException: If location not found or user not within geofence
    """
    # Check if user is already checked in
    active_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.check_out_time.is_(None)
    ).first()
    
    if active_record:
        logger.warning(
            "User %s attempted check-in while already checked in (Record ID: %d)",
            current_user.username, active_record.id
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already checked in. Please check out first.",
        )
    
    # Process based on location type
    if check_in_data.location_type == LocationType.OFFICE:
        # Check if the office exists
        if not check_in_data.office_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Office ID is required for office check-in",
            )
            
        office = db.query(Office).filter(Office.id == check_in_data.office_id).first()
        
        if not office:
            logger.warning("Office not found for check-in: ID %d", check_in_data.office_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Office not found"
            )
        
        # Verify that the user is within the office geofence
        geofence_status = GeofenceService.check_within_geofence(
            check_in_data.latitude, check_in_data.longitude, office
        )
        
        if not geofence_status.is_within_geofence:
            logger.warning(
                "User %s attempted check-in outside office geofence: %f meters from office %s",
                current_user.username, geofence_status.distance, office.name
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You are not within the geofence of the office. "
                      f"You are {geofence_status.distance:.2f} meters away.",
            )
        
        # Create attendance record for office
        attendance_record = AttendanceRecord(
            user_id=current_user.id,
            office_id=office.id,
            location_type=LocationType.OFFICE,
            check_in_time=datetime.now(),
            check_in_latitude=check_in_data.latitude,
            check_in_longitude=check_in_data.longitude,
        )
        
        location_name = office.name
        
    elif check_in_data.location_type == LocationType.HOME:
        # Check if the home address exists
        if not check_in_data.home_address_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Home address ID is required for home check-in",
            )
            
        home_address = db.query(UserHomeAddress).filter(
            UserHomeAddress.id == check_in_data.home_address_id,
            UserHomeAddress.user_id == current_user.id
        ).first()
        
        if not home_address:
            logger.warning(
                "Home address not found for check-in: ID %d", 
                check_in_data.home_address_id
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Home address not found"
            )
        
        # Verify that the user is within home geofence (if lat/long are provided)
        if home_address.latitude and home_address.longitude:
            geofence_status = GeofenceService.check_within_home_geofence(
                check_in_data.latitude, check_in_data.longitude, home_address
            )
            
            if not geofence_status.is_within_geofence:
                logger.warning(
                    "User %s attempted check-in outside home geofence: %f meters from home address",
                    current_user.username, geofence_status.distance
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"You are not within the geofence of your home address. "
                          f"You are {geofence_status.distance:.2f} meters away.",
                )
        
        # Create attendance record for home
        attendance_record = AttendanceRecord(
            user_id=current_user.id,
            home_address_id=home_address.id,
            location_type=LocationType.HOME,
            check_in_time=datetime.now(),
            check_in_latitude=check_in_data.latitude,
            check_in_longitude=check_in_data.longitude,
        )
        
        location_name = f"Home ({home_address.address_type})"
        
    else:  # LocationType.OTHER
        # Create attendance record for other location
        attendance_record = AttendanceRecord(
            user_id=current_user.id,
            location_type=LocationType.OTHER,
            check_in_time=datetime.now(),
            check_in_latitude=check_in_data.latitude,
            check_in_longitude=check_in_data.longitude,
        )
        
        location_name = "Other location"
    
    db.add(attendance_record)
    db.commit()
    db.refresh(attendance_record)
    
    logger.info(
        "User %s checked in at %s (Record ID: %d)",
        current_user.username, location_name, attendance_record.id
    )
    
    return attendance_record


@router.post("/check-out", response_model=AttendanceRecordSchema)
def check_out(
    *,
    db: Session = Depends(get_db),
    check_out_data: CheckOutCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Check out from any location.
    
    Args:
        db: Database session
        check_out_data: Check-out data
        current_user: Current authenticated user
    
    Returns:
        Updated attendance record
    
    Raises:
        HTTPException: If no active check-in found
    """
    # Find active attendance record
    attendance_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.check_out_time.is_(None)
    ).first()
    
    if not attendance_record:
        logger.warning("User %s attempted check-out without active check-in", current_user.username)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active check-in found. Please check in first.",
        )
    
    # Update the record with check-out data
    attendance_record.check_out_time = datetime.now()
    attendance_record.check_out_latitude = check_out_data.latitude
    attendance_record.check_out_longitude = check_out_data.longitude
    
    db.add(attendance_record)
    db.commit()
    db.refresh(attendance_record)
    
    # Determine location name for logging
    location_name = "Unknown"
    if attendance_record.location_type == LocationType.OFFICE and attendance_record.office:
        location_name = attendance_record.office.name
    elif attendance_record.location_type == LocationType.HOME and attendance_record.home_address:
        location_name = f"Home ({attendance_record.home_address.address_type})"
    elif attendance_record.location_type == LocationType.OTHER:
        location_name = "Other location"
    
    logger.info(
        "User %s checked out from %s (Record ID: %d)",
        current_user.username, location_name, attendance_record.id
    )
    
    return attendance_record


@router.post("/auto-logout", response_model=List[AttendanceRecordSchema])
async def auto_logout_expired_sessions(
    *,
    db: Session = Depends(get_db),
) -> Any:
    """Automatically log out users whose sessions have been active for more than 2 hours.
    
    This endpoint can be called by a scheduled task or cron job.
    
    Args:
        db: Database session
    
    Returns:
        List of updated attendance records
    """
    # Calculate the cutoff time (2 hours ago)
    cutoff_time = datetime.now() - timedelta(hours=2)
    
    # Find all active attendance records older than 2 hours
    expired_records = db.query(AttendanceRecord).filter(
        and_(
            AttendanceRecord.check_out_time.is_(None),
            AttendanceRecord.check_in_time < cutoff_time
        )
    ).all()
    
    updated_records = []
    
    for record in expired_records:
        # Update the record with auto-logout data
        record.check_out_time = datetime.now()
        # Maintain the same location as check-in for auto-logout
        record.check_out_latitude = record.check_in_latitude
        record.check_out_longitude = record.check_in_longitude
        
        db.add(record)
        updated_records.append(record)
        
        # Determine location name for logging
        location_name = "Unknown"
        if record.location_type == LocationType.OFFICE and record.office:
            location_name = record.office.name
        elif record.location_type == LocationType.HOME and record.home_address:
            location_name = f"Home ({record.home_address.address_type})"
        elif record.location_type == LocationType.OTHER:
            location_name = "Other location"
        
        logger.info(
            "User %s auto-logged out from %s after 2 hours (Record ID: %d)",
            record.user.username,
            location_name,
            record.id
        )
    
    if updated_records:
        db.commit()
        for record in updated_records:
            db.refresh(record)
        
        logger.info(
            "Auto-logout completed for %d users after 2-hour session limit",
            len(updated_records)
        )
    
    return updated_records


# Hook into the check-out endpoint to automatically log out expired sessions
@router.post("/check-out-with-auto-logout", response_model=AttendanceRecordSchema)
async def check_out_with_auto_logout(
    *,
    db: Session = Depends(get_db),
    check_out_data: CheckOutCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Check out from any location with auto-logout for expired sessions.
    
    This endpoint combines regular check-out with auto-logout functionality.
    
    Args:
        db: Database session
        check_out_data: Check-out data
        current_user: Current authenticated user
    
    Returns:
        Updated attendance record
    """
    # First, perform auto-logout for all expired sessions
    await auto_logout_expired_sessions(db=db)
    
    # Then, perform regular check-out for the current user
    return check_out(
        db=db,
        check_out_data=check_out_data,
        current_user=current_user
    )

@router.get("/history", response_model=List[AttendanceRecordSchema])
def get_attendance_history(
    *,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    location_type: Optional[LocationType] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get attendance history for the current user.
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        user_id: Filter by user ID (optional)
        location_type: Filter by location type (optional)
        current_user: Current authenticated user
    
    Returns:
        List of attendance records
    """
    query = db.query(AttendanceRecord)

    if user_id:
        query = query.filter(AttendanceRecord.user_id == user_id)
    else:
        query = query.filter(AttendanceRecord.user_id == current_user.id)
    
    if location_type:
        query = query.filter(AttendanceRecord.location_type == location_type)

    records = query.order_by(
        AttendanceRecord.check_in_time.desc()
    ).offset(skip).limit(limit).all()
    
    logger.info(
        "Retrieved %d attendance records for user %s%s",
        len(records), 
        current_user.username,
        f" with location type {location_type}" if location_type else ""
    )
    
    return records


@router.get("/status", response_model=AttendanceRecordSchema)
def get_attendance_status(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current attendance status for the user.
    
    Args:
        db: Database session
        current_user: Current authenticated user
    
    Returns:
        Active attendance record
    
    Raises:
        HTTPException: If no active check-in found
    """
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.check_out_time.is_(None)
    ).first()
    
    if not record:
        logger.info("User %s has no active check-in", current_user.username)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active check-in found.",
        )
    
    # Determine location name for logging
    location_name = "Unknown"
    if record.location_type == LocationType.OFFICE and record.office:
        location_name = record.office.name
    elif record.location_type == LocationType.HOME and record.home_address:
        location_name = f"Home ({record.home_address.address_type})"
    elif record.location_type == LocationType.OTHER:
        location_name = "Other location"
    
    logger.info(
        "Retrieved active attendance record for user %s at %s (Record ID: %d)",
        current_user.username, location_name, record.id
    )
    
    return record