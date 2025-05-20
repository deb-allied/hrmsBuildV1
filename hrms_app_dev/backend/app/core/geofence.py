from typing import List, Optional

import math
from sqlalchemy.orm import Session

from app.logger import logger
from app.models.models import Office, UserHomeAddress
from app.schemas.schemas import GeofenceStatus


class GeofenceService:
    """Service for geofencing calculations and checks."""

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the great circle distance between two points on Earth in meters.
        
        Args:
            lat1: Latitude of point 1 in decimal degrees
            lon1: Longitude of point 1 in decimal degrees
            lat2: Latitude of point 2 in decimal degrees
            lon2: Longitude of point 2 in decimal degrees
            
        Returns:
            Distance between the points in meters
        """
        # Convert decimal degrees to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of Earth in meters
        earth_radius = 6371000
        
        # Calculate distance
        distance = earth_radius * c
        
        return distance

    @classmethod
    def check_within_geofence(cls, lat: float, lon: float, office: Office) -> GeofenceStatus:
        """Check if a location is within the geofence of an office.
        
        Args:
            lat: Latitude of the location to check
            lon: Longitude of the location to check
            office: Office object with geofence data
            
        Returns:
            GeofenceStatus object with check results
        """
        # Calculate distance between location and office
        distance = cls.haversine_distance(lat, lon, office.latitude, office.longitude)
        
        # Check if within geofence radius
        is_within_geofence = distance <= office.radius
        
        logger.debug(
            "Geofence check for office %s: distance = %f meters, within geofence = %s",
            office.name, distance, is_within_geofence
        )
        
        return GeofenceStatus(
            is_within_geofence=is_within_geofence,
            office_id=office.id,
            office_name=office.name,
            distance=distance
        )
    
    @classmethod
    def check_within_home_geofence(cls, lat: float, lon: float, home_address: UserHomeAddress) -> GeofenceStatus:
        """Check if a location is within the geofence of a home address.
        
        Args:
            lat: Latitude of the location to check
            lon: Longitude of the location to check
            home_address: UserHomeAddress object with location data
            
        Returns:
            GeofenceStatus object with check results
        """
        # Calculate distance between location and home address
        distance = cls.haversine_distance(lat, lon, home_address.latitude, home_address.longitude)

        # Using a default radius of 500 meters for home address geofence
        home_radius = 500  # meters
        
        # Check if within geofence radius
        is_within_geofence = distance <= home_radius
        
        logger.debug(
            "Geofence check for home address %s: distance = %f meters, within geofence = %s",
            home_address.address_type, distance, is_within_geofence
        )
        
        return GeofenceStatus(
            is_within_geofence=is_within_geofence,
            home_address_id=home_address.id,
            address_type=home_address.address_type,
            distance=distance
        )

    @classmethod
    def check_all_geofences(cls, db: Session, lat: float, lon: float) -> List[GeofenceStatus]:
        """Check a location against all office geofences.
        
        Args:
            db: Database session
            lat: Latitude of the location to check
            lon: Longitude of the location to check
            
        Returns:
            List of GeofenceStatus objects for all offices
        """
        from app.models.models import Office
        
        # Get all offices
        offices = db.query(Office).all()
        
        # Check against each office
        results = []
        for office in offices:
            status = cls.check_within_geofence(lat, lon, office)
            results.append(status)
        
        # Sort by distance (closest first)
        results.sort(key=lambda x: x.distance)
        
        return results