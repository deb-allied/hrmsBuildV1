/**
 * Authentication-related functionality
 */
class AuthService {
    /**
     * Check if the user is currently authenticated
     * @returns {boolean} True if authenticated, false otherwise
     */
    static isAuthenticated() {
        return !!localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
    }

    /**
     * Get the current user data
     * @returns {Object|null} User data or null if not authenticated
     */
    static getCurrentUser() {
        const userJson = localStorage.getItem(CONFIG.STORAGE_USER_KEY);
        return userJson ? JSON.parse(userJson) : null;
    }

    /**
     * Get the authentication token
     * @returns {string|null} The token or null if not authenticated
     */
    static getToken() {
        return localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
    }

    /**
     * Set the authentication data
     * @param {string} token - The authentication token
     * @param {Object} user - The user data
     */
    static setAuth(token, user) {
        localStorage.setItem(CONFIG.STORAGE_TOKEN_KEY, token);
        localStorage.setItem(CONFIG.STORAGE_USER_KEY, JSON.stringify(user));
    }

    /**
     * Clear the authentication data
     */
    static clearAuth() {
        localStorage.removeItem(CONFIG.STORAGE_TOKEN_KEY);
        localStorage.removeItem(CONFIG.STORAGE_USER_KEY);
    }

    /**
     * Log in a user
     * @param {string} username - The username
     * @param {string} password - The password
     * @returns {Promise<Object>} The token response
     */
    static async login(username, password) {
        try {
            // Format data as form data for FastAPI token endpoint
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Get the current user profile
     * @returns {Promise<Object>} The user profile
     */
    static async getProfile() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                },
            });

            if (!response.ok) {
                // If unauthorized, clear auth data
                if (response.status === 401) {
                    this.clearAuth();
                }
                const error = await response.json();
                throw new Error(error.detail || 'Failed to fetch profile');
            }

            return await response.json();
        } catch (error) {
            console.error('Get profile error:', error);
            throw error;
        }
    }

    /**
     * Log out the current user
     */
    static async logout() {
        try {
            if (this.isAuthenticated()) {
                // Call the backend logout endpoint
                await fetch(`${CONFIG.API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.getToken()}`,
                    },
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Always clear local auth data
            this.clearAuth();
            // Redirect to login page
            location.reload();
        }
    }
}

// DOM event listeners for auth elements
document.addEventListener('DOMContentLoaded', () => {
    // Login form submission
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const tokenData = await AuthService.login(username, password);
            // Get user profile with the token
            AuthService.setAuth(tokenData.access_token, null);
            const userData = await AuthService.getProfile();
            
            // Update auth with full user data
            AuthService.setAuth(tokenData.access_token, userData);
            
            // Redirect admins to admin panel, others to main app
            if (userData.is_admin || userData.is_super_admin) {
                window.location.href = 'admin.html';
            } else {
                // Refresh the page to show dashboard
                location.reload();
            }
        } catch (error) {
            showError(error.message);
        }
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        AuthService.logout();
    });
});