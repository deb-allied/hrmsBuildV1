# app/core/ldap.py
import ssl
from typing import Optional, Tuple, Dict, Any

from ldap3 import Server, Connection, ALL, NTLM, SUBTREE
from ldap3.core.exceptions import LDAPException

from app.config import settings
from app.logger import logger


class LDAPAuth:
    """LDAP Authentication service for Microsoft Active Directory."""

    @staticmethod
    def get_connection() -> Connection:
        """
        Create and return an LDAP connection to the Active Directory server.
        
        Returns:
            Connection: LDAP connection object
        """
        # SSL/TLS Context
        tls_context = ssl.create_default_context()
        tls_context.check_hostname = False
        # In production, consider using CERT_REQUIRED with proper certificates
        tls_context.verify_mode = ssl.CERT_NONE
        
        # Create server object
        server = Server(
            host=settings.LDAP_SERVER,
            port=settings.LDAP_PORT,
            # use_ssl=settings.LDAP_USE_SSL,
            get_info=ALL,
            # tls=tls_context if settings.LDAP_USE_SSL else None
        )
        
        # Create connection using service account
        conn = Connection(
            server,
            user=settings.LDAP_BIND_DN,
            password=settings.LDAP_BIND_PASSWORD,
            # authentication=NTLM if settings.LDAP_USE_NTLM else None,
            auto_bind=True
        )
        
        logger.debug("LDAP connection established to %s", settings.LDAP_SERVER)
        return conn

    @classmethod
    def authenticate(cls, username: str, password: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Authenticate a user against LDAP Active Directory.
        
        Args:
            username: Username (sAMAccountName) to authenticate
            password: Password to verify
        
        Returns:
            Tuple containing:
            - Boolean success status
            - User attributes dictionary if successful, None otherwise
        """
        try:
            # Get service account connection
            conn = cls.get_connection()
            
            # Search for user
            search_filter = f"(sAMAccountName={username})"
            
            logger.debug("Searching for LDAP user: %s", username)
            conn.search(
                search_base=settings.LDAP_SEARCH_BASE,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=['cn', 'mail', 'displayName', 'memberOf']
            )
            
            if len(conn.entries) != 1:
                logger.warning("LDAP user not found or multiple entries for username: %s", username)
                return False, None
            
            # Get user DN
            user_dn = conn.entries[0].entry_dn
            
            # Try to bind with user credentials
            user_conn = Connection(
                conn.server,
                user=user_dn,
                password=password,
                authentication=NTLM if settings.LDAP_USE_NTLM else None,
            )
            
            # Attempt connection
            if not user_conn.bind():
                logger.warning("LDAP bind failed for user: %s", username)
                return False, None
            
            # Authentication successful
            logger.info("LDAP authentication successful for user: %s", username)
            
            # Extract user attributes
            user_attrs = {
                'email': conn.entries[0].mail.value if hasattr(conn.entries[0], 'mail') else None,
                'full_name': conn.entries[0].displayName.value if hasattr(conn.entries[0], 'displayName') else None,
                'groups': [str(group) for group in conn.entries[0].memberOf] if hasattr(conn.entries[0], 'memberOf') else []
            }
            
            # Close connections
            user_conn.unbind()
            conn.unbind()
            
            return True, user_attrs
            
        except LDAPException as e:
            logger.error("LDAP authentication error for user %s: %s", username, str(e))
            return False, None
        except Exception as e:
            logger.error("Unexpected error during LDAP authentication for user %s: %s", username, str(e))
            return False, None

    @classmethod
    def get_user_info(cls, username: str) -> Optional[Dict[str, Any]]:
        """
        Get user information from LDAP without authentication.
        
        Args:
            username: Username to look up
        
        Returns:
            Dictionary of user attributes if found, None otherwise
        """
        try:
            # Get service account connection
            conn = cls.get_connection()
            
            # Search for user
            search_filter = f"(sAMAccountName={username})"
            
            conn.search(
                search_base=settings.LDAP_SEARCH_BASE,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=['cn', 'mail', 'displayName', 'memberOf']
            )
            
            if len(conn.entries) != 1:
                return None
            
            # Extract user attributes
            user_attrs = {
                'email': conn.entries[0].mail.value if hasattr(conn.entries[0], 'mail') else None,
                'full_name': conn.entries[0].displayName.value if hasattr(conn.entries[0], 'displayName') else None,
                'groups': [str(group) for group in conn.entries[0].memberOf] if hasattr(conn.entries[0], 'memberOf') else []
            }
            
            # Close connection
            conn.unbind()
            
            return user_attrs
        except Exception as e:
            logger.error("Error retrieving LDAP user info for %s: %s", username, str(e))
            return None

    @classmethod
    def is_admin(cls, groups: list) -> bool:
        """Check if user is a member of the admin group."""
        return any(settings.LDAP_ADMIN_GROUP.lower() in group.lower() for group in groups)
    
    @classmethod
    def is_super_admin(cls, groups: list) -> bool:
        """Check if user is a member of the super admin group."""
        return any(settings.LDAP_SUPERADMIN_GROUP.lower() in group.lower() for group in groups)