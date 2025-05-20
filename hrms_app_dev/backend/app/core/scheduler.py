# File: app/core/scheduler.py

import logging
from datetime import datetime, timedelta
import asyncio
from typing import Optional

import httpx
from fastapi import Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db.base import SessionLocal

# Configure logger
logger = logging.getLogger(__name__)


class AutoLogoutScheduler:
    """Scheduler for automatically logging out users after their session expires."""
    
    def __init__(self, interval_minutes: int = 10):
        """Initialize the auto-logout scheduler.
        
        Args:
            interval_minutes: Interval in minutes to run the auto-logout check
        """
        self.interval_minutes = interval_minutes
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        logger.info("Auto-logout scheduler initialized with %d minute interval", interval_minutes)
    
    async def _get_db(self):
        """Get a database session.
        
        Yields:
            Database session
        """
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    async def _run_auto_logout(self):
        """Run the auto-logout task periodically."""
        logger.info("Starting auto-logout scheduler")
        self.is_running = True
        
        while self.is_running:
            try:
                logger.debug("Running scheduled auto-logout task")
                
                # Call the auto-logout endpoint
                # Edit before Deployment
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"http://10.1.5.80:8051{settings.API_V1_STR}/attendance/auto-logout"
                    )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(
                        "Scheduled auto-logout completed successfully: %d users logged out",
                        len(result)
                    )
                else:
                    logger.error(
                        "Scheduled auto-logout failed with status code %d: %s",
                        response.status_code,
                        response.text
                    )
            
            except Exception as e:
                logger.exception("Error in scheduled auto-logout task: %s", str(e))
            
            # Wait for the next interval
            await asyncio.sleep(self.interval_minutes * 60)
    
    def start(self):
        """Start the auto-logout scheduler."""
        if self.is_running:
            logger.warning("Auto-logout scheduler is already running")
            return
        
        self.task = asyncio.create_task(self._run_auto_logout())
        logger.info("Auto-logout scheduler started")
    
    def stop(self):
        """Stop the auto-logout scheduler."""
        if not self.is_running:
            logger.warning("Auto-logout scheduler is not running")
            return
        
        self.is_running = False
        if self.task:
            self.task.cancel()
        
        logger.info("Auto-logout scheduler stopped")
