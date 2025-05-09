from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.scheduler import AutoLogoutScheduler
from app.api import attendance, auth, offices
from app.config import settings
from app.db.base import Base, engine
from app.logger import logger
from app.api import admin

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

app.include_router(
    admin.router, 
    prefix=f"{settings.API_V1_STR}/admin", 
    tags=["admin"]
)

# Set up CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # If no specific origins set, allow all
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(offices.router, prefix=f"{settings.API_V1_STR}/offices", tags=["offices"])
app.include_router(attendance.router, prefix=f"{settings.API_V1_STR}/attendance", tags=["attendance"])


@app.get("/")
def root():
    """Root endpoint for API health check."""
    return {"message": "Welcome to the Attendance Tracker API"}


# Initialize auto-logout scheduler
auto_logout_scheduler = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup."""
    global auto_logout_scheduler
    
    logger.info("Starting application")
    
    if settings.AUTO_LOGOUT_ENABLED:
        logger.info(
            "Auto-logout feature enabled with %d-hour timeout and %d-minute check interval",
            settings.AUTO_LOGOUT_SESSION_HOURS,
            settings.AUTO_LOGOUT_INTERVAL_MINUTES
        )
        auto_logout_scheduler = AutoLogoutScheduler(
            interval_minutes=settings.AUTO_LOGOUT_INTERVAL_MINUTES
        )
        auto_logout_scheduler.start()
    else:
        logger.info("Auto-logout feature disabled")
    
    # Create first superadmin if needed
    await create_first_superadmin()

@app.on_event("startup")
async def create_first_superadmin():
    """Create the first super admin if no users exist."""
    from app.db.base import SessionLocal
    from app.models.models import User
    from app.core.auth import get_password_hash
    import os
    
    db = SessionLocal()
    try:
        # Check if any users exist
        user_count = db.query(User).count()
        
        if user_count == 0:
            # Get super admin credentials from environment variables
            super_admin_username = os.getenv("SUPER_ADMIN_USERNAME", "superadmin")
            super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@example.com")
            super_admin_password = os.getenv("SUPER_ADMIN_PASSWORD", "superadmin123")
            
            # Create super admin user
            super_admin = User(
                email=super_admin_email,
                username=super_admin_username,
                hashed_password=get_password_hash(super_admin_password),
                full_name="Super Admin Debshishu",
                is_active=True,
                is_admin=True,
                is_super_admin=True,
            )
            
            db.add(super_admin)
            db.commit()
            db.refresh(super_admin)
            
            logger.info("Created first super admin user: %s", super_admin_username)
            logger.warning("Please change the default super admin password immediately!")
    except Exception as e:
        logger.error("Error creating first super admin: %s", str(e))
    finally:
        db.close()


@app.on_event("shutdown")
async def shutdown_event():
    """Execute tasks at application shutdown."""
    logger.info("Shutting down Attendance Tracker API")


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Attendance Tracker API server")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8051, reload=True)