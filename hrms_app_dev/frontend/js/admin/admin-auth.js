/**
 * Admin authentication functionality
 */
class AdminAuthService {
    /**
     * Check if the user is an admin
     * @returns {boolean} True if admin, false otherwise
     */
    static isAdmin() {
        const user = AuthService.getCurrentUser();
        return user && (user.is_admin || user.is_super_admin);
    }

    /**
     * Check if the user is a super admin
     * @returns {boolean} True if super admin, false otherwise
     */
    static isSuperAdmin() {
        const user = AuthService.getCurrentUser();
        return user && user.is_super_admin;
    }

    /**
     * Redirect to login page if not authenticated
     */
    static checkAdminAuth() {
        if (!AuthService.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }

        if (!AdminAuthService.isAdmin()) {
            showAdminError('You do not have admin privileges.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return false;
        }

        return true;
    }

    /**
     * Update UI based on admin privileges
     */
    static updateAdminUI() {
        const adminName = document.getElementById('admin-name');
        const adminManagementLink = document.getElementById('admin-management-link');
        
        const user = AuthService.getCurrentUser();
        
        if (user) {
            adminName.textContent = user.username;
            
            if (user.is_super_admin) {
                adminManagementLink.style.display = 'block';
            } else {
                adminManagementLink.style.display = 'none';
            }
        }
    }
}

/**
 * Display an error message in the admin interface
 * @param {string} message - The error message to display
 */
function showAdminError(message) {
    const errorElement = document.getElementById('admin-error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}