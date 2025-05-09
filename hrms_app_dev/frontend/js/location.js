/**
 * Location and map-related functionality with enhanced accuracy
 */
class LocationService {
    constructor() {
        // Initialize map and markers properties
        this.map = null;
        this.userMarker = null;
        this.officeMarkers = [];
        this.geofenceCircles = [];
        this.currentPosition = null;
        this.accuracyCircle = null;
        this.logger = this.initLogger();
        
        // Progressive location settings
        this.locationSettings = {
            enableHighAccuracy: true,
            maximumAge: 0,                // Always get fresh location
            timeout: 10000,               // Initial timeout (10 seconds)
            desiredAccuracy: 100,          // Target accuracy in meters
            accuracyAttempts: 0,          // Track number of accuracy attempts
            maxAccuracyAttempts: 3,       // Maximum number of accuracy improvement attempts
            progressiveTimeoutIncrease: 5000  // Increase timeout by 5 seconds each attempt
        };
        
        // Initialize geofence modal elements once the DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.initGeofenceModal();
        });
    }

    /**
     * Initialize logger for this service
     * @returns {Object} Logger object
     */
    initLogger() {
        return {
            info: (message, ...args) => console.info(`[LocationService] ${message}`, ...args),
            error: (message, ...args) => console.error(`[LocationService] ${message}`, ...args),
            warn: (message, ...args) => console.warn(`[LocationService] ${message}`, ...args),
            debug: (message, ...args) => console.debug(`[LocationService] ${message}`, ...args)
        };
    }

    /**
     * Initialize the map
     */
    initMap() {
        // Create the map centered at default location
        this.map = L.map('map').setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Start continuous location tracking for highest accuracy
        this.startContinuousLocationTracking();
        
        // Load offices data
        this.loadOffices();
        
        // Add accuracy indicator control
        this.addAccuracyIndicator();
    }

    /**
     * Add accuracy indicator to the map
     */
    addAccuracyIndicator() {
        // Create a custom control for accuracy display
        const AccuracyControl = L.Control.extend({
            options: {
                position: 'bottomleft'
            },
            
            onAdd: () => {
                const container = L.DomUtil.create('div', 'accuracy-control leaflet-bar');
                container.id = 'accuracy-indicator';
                container.innerHTML = '<span id="accuracy-value">Accuracy: Waiting...</span>';
                return container;
            }
        });
        
        // Add the control to the map
        this.map.addControl(new AccuracyControl());
    }

    /**
     * Update accuracy indicator with current accuracy
     * @param {number} accuracy - Current accuracy in meters
     */
    updateAccuracyIndicator(accuracy) {
        const indicator = document.getElementById('accuracy-value');
        if (indicator) {
            let accuracyClass = 'high-accuracy';
            
            if (accuracy > 50) {
                accuracyClass = 'low-accuracy';
            } else if (accuracy > 20) {
                accuracyClass = 'medium-accuracy';
            }
            
            indicator.className = accuracyClass;
            indicator.textContent = `Accuracy: ${accuracy.toFixed(1)}m`;
        }
    }

    /**
     * Initialize geofence warning modal event listeners
     */
    initGeofenceModal() {
        const modal = document.getElementById('geofence-modal');
        const backdrop = document.getElementById('modal-backdrop');
        
        if (!modal || !backdrop) {
            this.logger.error('Geofence modal elements not found');
            return;
        }
        
        // Set up event handlers for closing the modal
        const closeButtons = modal.querySelectorAll('.close-modal');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => this.hideGeofenceWarning());
        });
        
        // Clicking backdrop also closes modal
        backdrop.addEventListener('click', () => this.hideGeofenceWarning());
        
        // Override the check-in button to verify geofence before proceeding
        const checkInBtn = document.getElementById('check-in-btn');
        if (checkInBtn) {
            // Store the original click handler if it exists
            const originalHandler = checkInBtn.onclick;
            
            // Replace with our handler
            checkInBtn.onclick = async (event) => {
                event.preventDefault();
                
                // Get current position and check geofence
                try {
                    const position = await this.getCurrentPosition();
                    
                    // Check if accuracy meets requirements for check-in
                    if (position.coords.accuracy > this.locationSettings.desiredAccuracy) {
                        showError(`Location accuracy (${position.coords.accuracy.toFixed(1)}m) is not sufficient for check-in. Please wait for better accuracy.`);
                        return;
                    }
                    
                    const { latitude, longitude } = position.coords;
                    
                    const results = await this.checkGeofenceStatus(latitude, longitude);
                    const withinGeofence = results && results.some(result => result.is_within_geofence);
                    
                    if (withinGeofence) {
                        // If original handler exists, call it
                        if (typeof originalHandler === 'function') {
                            originalHandler.call(checkInBtn, event);
                        }
                    } else {
                        // Show warning if outside geofence
                        this.showGeofenceWarning();
                    }
                } catch (error) {
                    showError(`Location error: ${error.message}`);
                }
            };
        }
    }

    /**
     * Show geofence warning modal
     */
    showGeofenceWarning() {
        const modal = document.getElementById('geofence-modal');
        const backdrop = document.getElementById('modal-backdrop');
        
        if (modal && backdrop) {
            modal.style.display = 'block';
            backdrop.style.display = 'block';
            
            // Initialize feather icons in the modal if available
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Hide geofence warning modal
     */
    hideGeofenceWarning() {
        const modal = document.getElementById('geofence-modal');
        const backdrop = document.getElementById('modal-backdrop');
        
        if (modal && backdrop) {
            modal.style.display = 'none';
            backdrop.style.display = 'none';
        }
    }

    /**
     * Initialize the map and locate user without continuous tracking
     * We'll focus on high accuracy for each individual locate request
     */
    initMap() {
        // Create the map centered at default location
        this.map = L.map('map').setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Locate the user immediately with high accuracy
        this.locateUser();
        
        // Load offices data
        this.loadOffices();
        
        // Add accuracy indicator control
        this.addAccuracyIndicator();
    }

    /**
     * Handle position updates from continuous tracking
     * @param {GeolocationPosition} position - The updated position
     */
    handlePositionUpdate(position) {
        // Store the current position
        this.currentPosition = position;
        
        const { latitude, longitude, accuracy } = position.coords;
        
        // Update coordinates display
        const coordsDisplay = document.getElementById('coordinates');
        if (coordsDisplay) {
            coordsDisplay.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
        }
        
        // Update accuracy indicator
        this.updateAccuracyIndicator(accuracy);
        
        // Create or update user marker
        this.updateUserMarker(latitude, longitude, accuracy);
        
        // Check if user is within any geofence
        this.checkGeofenceStatus(latitude, longitude);
        
        // Log accuracy for debugging
        this.logger.debug(`Position updated - Accuracy: ${accuracy.toFixed(1)}m`);
    }

    /**
     * Handle location errors
     * @param {GeolocationPositionError} error - The error
     */
    handleLocationError(error) {
        let errorMessage;
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access was denied by the user';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is unavailable';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out';
                break;
            default:
                errorMessage = `Unknown location error (${error.code}): ${error.message}`;
        }
        
        this.logger.error(`Geolocation error: ${errorMessage}`);
        showError(`Location error: ${errorMessage}`);
        
        // Use default location if geolocation fails
        if (this.map) {
            this.map.setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
        }
        
        // Try again with different settings if it was a timeout
        if (error.code === error.TIMEOUT && this.locationSettings.timeout < 30000) {
            this.locationSettings.timeout += 5000;
            this.logger.info(`Increasing location timeout to ${this.locationSettings.timeout}ms and retrying`);
            this.startContinuousLocationTracking();
        }
    }

    /**
     * Update the user marker on the map
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @param {number} accuracy - Position accuracy in meters
     */
    updateUserMarker(latitude, longitude, accuracy) {
        if (!this.map) return;
        
        const userLatLng = [latitude, longitude];
        
        // Create or update user marker
        if (this.userMarker) {
            this.userMarker.setLatLng(userLatLng);
        } else {
            this.userMarker = L.marker(userLatLng, {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: `<div style="background-color: ${CONFIG.USER_MARKER_COLOR}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>`,
                    iconSize: [15, 15],
                    iconAnchor: [7.5, 7.5]
                })
            }).addTo(this.map);
            this.userMarker.bindPopup('Your Location').openPopup();
        }
        
        // Create or update accuracy circle
        if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng(userLatLng);
            this.accuracyCircle.setRadius(accuracy);
        } else {
            this.accuracyCircle = L.circle(userLatLng, {
                radius: accuracy,
                fillColor: '#3388ff',
                fillOpacity: 0.15,
                color: '#3388ff',
                weight: 1
            }).addTo(this.map);
        }
        
        // Only center map if position change is significant or explicitly requested
        if (!this._lastCenteredPosition || 
            this.calculateDistance(
                latitude, 
                longitude, 
                this._lastCenteredPosition.lat, 
                this._lastCenteredPosition.lng
            ) > 10) {
            this.map.setView(userLatLng, this.map.getZoom());
            this._lastCenteredPosition = { lat: latitude, lng: longitude };
        }
    }

    /**
     * Get the user's current position with high accuracy
     * Uses progressive accuracy improvements for each request
     * @returns {Promise<GeolocationPosition>} The position
     */
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }
            
            // Always reset position for fresh measurement with max accuracy
            this.currentPosition = null;
            
            // Set up options for high accuracy
            const options = {
                enableHighAccuracy: this.locationSettings.enableHighAccuracy,
                maximumAge: this.locationSettings.maximumAge,
                timeout: this.locationSettings.timeout
            };
            
            // Get a fresh position with maximum accuracy
            this.logger.info(`Getting fresh position with options: ${JSON.stringify(options)}`);
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    this.currentPosition = position;
                    const accuracy = position.coords.accuracy;
                    
                    this.logger.info(`Got position with accuracy: ${accuracy.toFixed(1)}m`);
                    
                    // Check if we've reached desired accuracy
                    if (accuracy <= this.locationSettings.desiredAccuracy) {
                        this.logger.info(`Achieved desired accuracy: ${accuracy.toFixed(1)}m`);
                        this.locationSettings.accuracyAttempts = 0;  // Reset attempts counter
                        resolve(position);
                    } 
                    // If not accurate enough yet and we haven't reached max attempts, try again
                    else if (this.locationSettings.accuracyAttempts < this.locationSettings.maxAccuracyAttempts) {
                        this.locationSettings.accuracyAttempts++;
                        this.locationSettings.timeout += this.locationSettings.progressiveTimeoutIncrease;
                        
                        this.logger.info(`Attempt ${this.locationSettings.accuracyAttempts}: Increasing timeout to ${this.locationSettings.timeout}ms for better accuracy`);
                        
                        // Try again with increased timeout
                        setTimeout(() => {
                            this.getCurrentPosition()
                                .then(resolve)
                                .catch(reject);
                        }, 500); // Small delay before retry
                    } 
                    // If we've reached max attempts, use whatever we have
                    else {
                        this.logger.info(`Reached maximum accuracy attempts. Using best available: ${accuracy.toFixed(1)}m`);
                        this.locationSettings.accuracyAttempts = 0;  // Reset attempts counter
                        resolve(position);
                    }
                },
                error => {
                    this.logger.error(`Geolocation error: ${error.message}`);
                    
                    // If timeout error, try again with increased timeout
                    if (error.code === error.TIMEOUT && 
                        this.locationSettings.accuracyAttempts < this.locationSettings.maxAccuracyAttempts) {
                        
                        this.locationSettings.accuracyAttempts++;
                        this.locationSettings.timeout += this.locationSettings.progressiveTimeoutIncrease;
                        
                        this.logger.info(`Timeout error. Attempt ${this.locationSettings.accuracyAttempts}: Increasing timeout to ${this.locationSettings.timeout}ms`);
                        
                        // Try again with increased timeout
                        setTimeout(() => {
                            this.getCurrentPosition()
                                .then(resolve)
                                .catch(reject);
                        }, 500); // Small delay before retry
                    } else {
                        this.locationSettings.accuracyAttempts = 0;  // Reset attempts counter
                        reject(error);
                    }
                },
                options
            );
        });
    }

    /**
     * Locate the user on the map with maximum accuracy
     * Always forces a fresh position with high accuracy
     * @returns {Promise<GeolocationPosition>} The position
     */
    async locateUser() {
        try {
            // Display loading indicator
            const coordsDisplay = document.getElementById('coordinates');
            if (coordsDisplay) {
                coordsDisplay.textContent = 'Getting precise location...';
                coordsDisplay.classList.add('locating');
            }
            
            // Reset accuracy attempts for each explicit locate request
            this.locationSettings.accuracyAttempts = 0;
            
            // Always get a fresh position with maximum accuracy
            const position = await this.getCurrentPosition();
            const { latitude, longitude, accuracy } = position.coords;
            
            // Update coordinates display
            if (coordsDisplay) {
                coordsDisplay.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (±${accuracy.toFixed(1)}m)`;
                coordsDisplay.classList.remove('locating');
            }
            
            // Update accuracy indicator
            this.updateAccuracyIndicator(accuracy);
            
            // Update user marker and center map
            this.updateUserMarker(latitude, longitude, accuracy);
            this.map.setView([latitude, longitude], CONFIG.DEFAULT_MAP_ZOOM);
            
            // Check if user is within any geofence
            this.checkGeofenceStatus(latitude, longitude);
            
            this.logger.info(`Located user at ${latitude.toFixed(6)}, ${longitude.toFixed(6)} with accuracy: ${accuracy.toFixed(1)}m`);
            
            return position;
        } catch (error) {
            this.logger.error(`Location error: ${error.message}`);
            showError(`Location error: ${error.message}`);
            
            // Update coordinates display
            const coordsDisplay = document.getElementById('coordinates');
            if (coordsDisplay) {
                coordsDisplay.textContent = 'Location unavailable';
                coordsDisplay.classList.remove('locating');
            }
            
            // Use default location if geolocation fails
            this.map.setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
            
            throw error;
        }
    }

    /**
     * Load offices data from the API and display on map
     */
    async loadOffices() {
        try {
            if (!AuthService.isAuthenticated()) {
                this.logger.warn('User not authenticated, skipping office loading');
                return;
            }
            
            this.logger.info('Loading office locations');
            
            const response = await fetch(`${CONFIG.API_URL}/offices`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load office locations: ${response.status} ${response.statusText}`);
            }
            
            const offices = await response.json();
            this.logger.info(`Loaded ${offices.length} office locations`);
            
            // Clear existing markers
            this.clearOfficeMarkers();
            
            // Add new markers for each office
            offices.forEach(office => {
                this.addOfficeMarker(office);
            });
            
            return offices;
        } catch (error) {
            this.logger.error('Error loading offices:', error);
            showError(`Failed to load offices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Add an office marker to the map
     * @param {Object} office - The office data
     */
    addOfficeMarker(office) {
        // Create office marker
        const marker = L.marker([office.latitude, office.longitude], {
            icon: L.divIcon({
                className: 'office-location-marker',
                html: `<div style="background-color: ${CONFIG.OFFICE_MARKER_COLOR}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [15, 15],
                iconAnchor: [7.5, 7.5]
            })
        }).addTo(this.map);
        
        marker.bindPopup(`<b>${office.name}</b><br>${office.address}`);
        this.officeMarkers.push(marker);
        
        // Create geofence circle
        const circle = L.circle([office.latitude, office.longitude], {
            radius: office.radius,
            fillColor: CONFIG.GEOFENCE_COLOR,
            fillOpacity: CONFIG.GEOFENCE_OPACITY,
            color: CONFIG.GEOFENCE_COLOR,
            weight: 1
        }).addTo(this.map);
        
        // Store office data with the circle
        circle.office = office;
        this.geofenceCircles.push(circle);
        
        this.logger.debug(`Added office marker for ${office.name} at ${office.latitude}, ${office.longitude}`);
    }

    /**
     * Clear all office markers from the map
     */
    clearOfficeMarkers() {
        // Remove markers
        this.officeMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.officeMarkers = [];
        
        // Remove geofence circles
        this.geofenceCircles.forEach(circle => {
            this.map.removeLayer(circle);
        });
        this.geofenceCircles = [];
        
        this.logger.debug('Cleared all office markers');
    }

    /**
     * Check if user is within any geofence
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @returns {Promise<Array>} Geofence status results
     */
    async checkGeofenceStatus(latitude, longitude) {
        try {
            if (!AuthService.isAuthenticated()) {
                this.logger.warn('User not authenticated, skipping geofence check');
                return null;
            }
            
            this.logger.debug(`Checking geofence status for ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            
            // Include accuracy in API request for more accurate geofence detection
            const accuracy = this.currentPosition ? this.currentPosition.coords.accuracy : null;
            
            const response = await fetch(`${CONFIG.API_URL}/attendance/check-location`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    latitude,
                    longitude,
                    accuracy: accuracy
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to check geofence status: ${response.status} ${response.statusText}`);
            }
            
            const results = await response.json();
            
            // Update UI based on results
            const withinGeofence = results.some(result => result.is_within_geofence);
            
            // Update check-in button state
            const checkInBtn = document.getElementById('check-in-btn');
            if (checkInBtn) {
                // Only enable if within geofence AND we have sufficient accuracy
                const accuracyOk = this.currentPosition && 
                                  this.currentPosition.coords.accuracy <= this.locationSettings.desiredAccuracy;
                
                checkInBtn.disabled = !withinGeofence || !accuracyOk;
                
                // Set appropriate tooltip with precise accuracy information
                if (!withinGeofence) {
                    checkInBtn.title = 'You must be within an office geofence to check in';
                } else if (!accuracyOk) {
                    checkInBtn.title = `Location accuracy (${this.currentPosition.coords.accuracy.toFixed(1)}m) ` +
                                      `is not sufficient. Need ${this.locationSettings.desiredAccuracy}m or better. Try clicking the locate button again.`;
                } else {
                    checkInBtn.title = `Check in at this location (Accuracy: ${this.currentPosition.coords.accuracy.toFixed(1)}m)`;
                }
                
                // Add visual indicator of geofence status
                if (withinGeofence && accuracyOk) {
                    checkInBtn.classList.add('within-geofence');
                    checkInBtn.classList.remove('outside-geofence', 'accuracy-insufficient');
                } else if (withinGeofence) {
                    checkInBtn.classList.add('accuracy-insufficient');
                    checkInBtn.classList.remove('within-geofence', 'outside-geofence');
                } else {
                    checkInBtn.classList.add('outside-geofence');
                    checkInBtn.classList.remove('within-geofence', 'accuracy-insufficient');
                }
            }
            
            // Log result with accuracy details
            if (withinGeofence) {
                this.logger.info(`User is within a geofence. Location accuracy: ${accuracy ? accuracy.toFixed(1) + 'm' : 'unknown'}`);
            } else {
                this.logger.info(`User is outside all geofences. Location accuracy: ${accuracy ? accuracy.toFixed(1) + 'm' : 'unknown'}`);
            }
            
            return results;
        } catch (error) {
            this.logger.error('Error checking geofence status:', error);
            return null;
        }
    }

    /**
     * Check if a location is within any office geofence
     * @param {number} latitude - Latitude coordinate
     * @param {number} longitude - Longitude coordinate
     * @returns {boolean} True if within any geofence
     */
    isWithinAnyGeofence(latitude, longitude) {
        // Check each geofence circle
        for (const circle of this.geofenceCircles) {
            const officeLatLng = circle.getLatLng();
            const distance = this.calculateDistance(
                latitude,
                longitude,
                officeLatLng.lat,
                officeLatLng.lng
            );
            
            if (distance <= circle.office.radius) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - First latitude
     * @param {number} lon1 - First longitude
     * @param {number} lat2 - Second latitude
     * @param {number} lon2 - Second longitude
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance; // Result in meters
    }

    /**
     * Get the nearest office to the user's location
     * @returns {Promise<Object>} The nearest office data
     */
    async getNearestOffice() {
        if (!this.currentPosition) {
            await this.locateUser();
            if (!this.currentPosition) {
                throw new Error('Unable to get your location');
            }
        }
        
        const { latitude, longitude } = this.currentPosition.coords;
        
        const results = await this.checkGeofenceStatus(latitude, longitude);
        if (!results || results.length === 0) {
            return null;
        }
        
        // Find the nearest office (minimum distance)
        const nearestOffice = results.reduce((nearest, current) => {
            return (!nearest || current.distance < nearest.distance) ? current : nearest;
        }, null);
        
        return nearestOffice;
    }
    
    /**
     * Check if location services are available
     * @returns {boolean} True if location services are available
     */
    isLocationAvailable() {
        return !!navigator.geolocation;
    }
    
    /**
     * Toggle high accuracy mode on/off
     * @param {boolean} enableHighAccuracy - Whether to enable high accuracy
     */
    setHighAccuracyMode(enableHighAccuracy) {
        if (this.locationSettings.enableHighAccuracy !== enableHighAccuracy) {
            this.locationSettings.enableHighAccuracy = enableHighAccuracy;
            this.logger.info(`High accuracy mode ${enableHighAccuracy ? 'enabled' : 'disabled'}`);
            this.startContinuousLocationTracking();
        }
    }
    
    /**
     * Set the desired accuracy for check-in
     * @param {number} accuracy - Desired accuracy in meters
     */
    setDesiredAccuracy(accuracy) {
        this.locationSettings.desiredAccuracy = accuracy;
        this.logger.info(`Set desired accuracy to ${accuracy} meters`);
    }
}

// Create a global instance of the location service
const locationService = new LocationService();

// DOM event listeners for location elements
document.addEventListener('DOMContentLoaded', () => {
    // Locate button with high accuracy refresh
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            locateBtn.disabled = true;
            locateBtn.classList.add('locating');
            locateBtn.textContent = 'Getting precise location...';
            
            // Reset settings for maximum accuracy
            locationService.locationSettings.accuracyAttempts = 0;
            locationService.locationSettings.timeout = 10000; // Reset timeout
            
            // Force a fresh location update with high accuracy
            locationService.locateUser()
                .finally(() => {
                    locateBtn.disabled = false;
                    locateBtn.classList.remove('locating');
                    locateBtn.textContent = 'Locate Me';
                    
                    // Display accuracy result
                    if (locationService.currentPosition) {
                        const accuracy = locationService.currentPosition.coords.accuracy;
                        showToast(`Location updated with ${accuracy.toFixed(1)}m accuracy`);
                    }
                });
        });
    }
    
    // Add CSS for accuracy indicators and UI elements
    const style = document.createElement('style');
    style.textContent = `
        .accuracy-control {
            padding: 5px 10px;
            background: white;
            border-radius: 4px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        }
        .high-accuracy {
            color: green;
            font-weight: bold;
        }
        .medium-accuracy {
            color: orange;
            font-weight: bold;
        }
        .low-accuracy {
            color: red;
            font-weight: bold;
        }
        .accuracy-insufficient {
            background-color: #FFA500 !important;
            color: white;
        }
        .locating {
            position: relative;
        }
        .locating::after {
            content: '';
            position: absolute;
            width: 10px;
            height: 10px;
            top: 50%;
            left: 10px;
            margin-top: -5px;
            background-color: #3388ff;
            border-radius: 50%;
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.5); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
        }
        #toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
        }
        #toast.show {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
    
    // Add toast element for notifications
    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
    
    // Add a function to show toast messages
    window.showToast = function(message, duration = 3000) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }
    };
});