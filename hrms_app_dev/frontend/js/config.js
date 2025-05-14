/**
 * Configuration settings for the application.
 */
const CONFIG = {
    // API URL - change this to match your backend URL
    API_URL: 'http://localhost:8051/api/v1',
    
    // Default map center (if no location available)
    DEFAULT_MAP_CENTER: [40.7128, -74.0060], // New York City
    
    // Default zoom level for the map
    DEFAULT_MAP_ZOOM: 13,
    
    // Local storage keys
    STORAGE_TOKEN_KEY: 'attendance_token',
    STORAGE_USER_KEY: 'attendance_user',
    
    // Geofence settings
    GEOFENCE_RADIUS_METERS: 100,
    
    // Appearance settings for map markers
    USER_MARKER_COLOR: 'blue',
    OFFICE_MARKER_COLOR: 'red',
    GEOFENCE_COLOR: 'green',
    GEOFENCE_OPACITY: 0.2,
};

/**
 * Format a date object into a readable string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

/**
 * Format a date object into a time string
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string
 */
function formatTime(date) {
    return new Date(date).toLocaleTimeString();
}

/**
 * Calculate duration between two dates
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {string} Formatted duration string
 */
function calculateDuration(startDate, endDate) {
    if (!startDate || !endDate) return '-';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate difference in milliseconds
    const diff = end - start;
    
    // Convert to hours and minutes
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
}

/**
 * Display an error message to the user
 * @param {string} message - The error message to display
 */
function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}