from typing import Dict, List, Optional, Tuple, Union

from haversine import haversine
from sqlalchemy.orm import Session

from app.logger import logger
from app.models.models import Office
from app.schemas.schemas import GeofenceStatus


class GeofenceService:
    """Service for handling geofence-related operations."""
    
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the distance between two geographic coordinates.
        
        Args:
            lat1: Latitude of first point
            lon1: Longitude of first point
            lat2: Latitude of second point
            lon2: Longitude of second point
            
        Returns:
            Distance in meters
        """
        # Convert from km to meters
        return haversine((lat1, lon1), (lat2, lon2), unit='m')

    @classmethod
    def check_within_geofence(
        cls, 
        latitude: float, 
        longitude: float, 
        office: Office
    ) -> GeofenceStatus:
        """Check if coordinates are within a specific office geofence.
        
        Args:
            latitude: Latitude to check
            longitude: Longitude to check
            office: Office object with geofence parameters
            
        Returns:
            GeofenceStatus object with results
        """
        distance = cls.calculate_distance(
            latitude, longitude, 
            office.latitude, office.longitude
        )
        
        is_within = distance <= office.radius
        
        logger.info(
            "Location check: (%f, %f) to Office %s (%f, %f) - Distance: %f m, Within: %s",
            latitude, longitude, office.name, office.latitude, office.longitude, 
            distance, is_within
        )
        
        return GeofenceStatus(
            is_within_geofence=is_within,
            office_id=office.id,
            office_name=office.name,
            distance=distance
        )

    @classmethod
    def check_all_geofences(
        cls, 
        db: Session, 
        latitude: float, 
        longitude: float
    ) -> List[GeofenceStatus]:
        """Check if coordinates are within any office geofence.
        
        Args:
            db: Database session
            latitude: Latitude to check
            longitude: Longitude to check
            
        Returns:
            List of GeofenceStatus objects for all offices
        """
        offices = db.query(Office).all()
        results = []
        
        for office in offices:
            status = cls.check_within_geofence(latitude, longitude, office)
            results.append(status)
        
        return results

    @classmethod
    def find_nearest_geofence(
        cls, 
        db: Session, 
        latitude: float, 
        longitude: float
    ) -> Optional[GeofenceStatus]:
        """Find the nearest office geofence to the given coordinates.
        
        Args:
            db: Database session
            latitude: Latitude to check
            longitude: Longitude to check
            
        Returns:
            GeofenceStatus object for the nearest office
        """
        results = cls.check_all_geofences(db, latitude, longitude)
        
        if not results:
            return None
            
        # Find the result with minimum distance
        return min(results, key=lambda x: x.distance)