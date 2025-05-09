import logging
import sys
from typing import Any, Dict, Optional

class Logger:
    """Custom logger class for the application."""
    
    def __init__(self, name: str, level: int = logging.INFO) -> None:
        """Initialize the logger.
        
        Args:
            name: The name of the logger
            level: The log level
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
    
    def debug(self, msg: str, *args: Any, **kwargs: Dict[str, Any]) -> None:
        """Log a debug message.
        
        Args:
            msg: The message format string
            args: The arguments to be formatted in the message
            kwargs: The keyword arguments to be formatted in the message
        """
        if self.logger.isEnabledFor(logging.DEBUG):
            self.logger.debug(msg, *args, **kwargs)
    
    def info(self, msg: str, *args: Any, **kwargs: Dict[str, Any]) -> None:
        """Log an info message.
        
        Args:
            msg: The message format string
            args: The arguments to be formatted in the message
            kwargs: The keyword arguments to be formatted in the message
        """
        if self.logger.isEnabledFor(logging.INFO):
            self.logger.info(msg, *args, **kwargs)
    
    def warning(self, msg: str, *args: Any, **kwargs: Dict[str, Any]) -> None:
        """Log a warning message.
        
        Args:
            msg: The message format string
            args: The arguments to be formatted in the message
            kwargs: The keyword arguments to be formatted in the message
        """
        if self.logger.isEnabledFor(logging.WARNING):
            self.logger.warning(msg, *args, **kwargs)
    
    def error(self, msg: str, *args: Any, **kwargs: Dict[str, Any]) -> None:
        """Log an error message.
        
        Args:
            msg: The message format string
            args: The arguments to be formatted in the message
            kwargs: The keyword arguments to be formatted in the message
        """
        if self.logger.isEnabledFor(logging.ERROR):
            self.logger.error(msg, *args, **kwargs)
    
    def critical(self, msg: str, *args: Any, **kwargs: Dict[str, Any]) -> None:
        """Log a critical message.
        
        Args:
            msg: The message format string
            args: The arguments to be formatted in the message
            kwargs: The keyword arguments to be formatted in the message
        """
        if self.logger.isEnabledFor(logging.CRITICAL):
            self.logger.critical(msg, *args, **kwargs)

# Create a default logger instance
logger = Logger("attendance_tracker")