import ssl
from typing import Tuple, Optional, Dict, Any
from ldap3 import Server, Connection, ALL, SIMPLE
from ldap3.core.exceptions import LDAPException

from app.config import settings
from app.logger import logger


class LDAPAuth:
    """LDAP authentication directly via user credentials (no bind DN)."""

    @classmethod
    def authenticate(cls, username: str, password: str) -> Tuple[bool, Optional[str]]:
        """
        Attempt to authenticate user directly with provided credentials.
        
        Args:
            username: The username (e.g., 'jdoe')
            password: The user's password
        
        Returns:
            Tuple of (True, DN string) if successful, else (False, None)
        """
        try:
            # Build full user UPN
            user_upn = f"{username}@{settings.LDAP_DOMAIN}"

            # Set up server (optionally use SSL/TLS)
            tls_context = ssl.create_default_context()
            tls_context.check_hostname = False
            tls_context.verify_mode = ssl.CERT_NONE  # In production, use CERT_REQUIRED

            server = Server(
                settings.LDAP_SERVER,
                port=settings.LDAP_PORT,
                get_info=ALL
            )

            # Attempt to bind with user credentials
            conn = Connection(
                server,
                user=user_upn,
                password=password,
                authentication=SIMPLE
            )

            logger.info("LDAP authentication successful for user: %s", username, password)
            user_dn = conn.user
            conn.unbind()
            return True, user_dn

        except LDAPException as e:
            logger.warning("LDAP authentication failed for user %s: %s", username, str(e))
            return False, None
        except Exception as e:
            logger.error("Unexpected error during LDAP authentication for %s: %s", username, str(e))
            return False, None
