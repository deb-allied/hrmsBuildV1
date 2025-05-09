/**
 * Admin office management functionality
 */
class OfficeService {
    constructor() {
        this.map = null;
        this.officeMarkers = [];
        this.geofenceCircles = [];
    }

    /**
     * Initialize the admin map
     */
    initMap() {
        // Create the map centered at default location
        this.map = L.map('admin-map').setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Load offices
        this.loadOffices();
        
        // Set up map click event for picking coordinates
        this.map.on('click', (e) => {
            // If office modal is open, update latitude and longitude fields
            if (document.getElementById('office-modal').style.display === 'block') {
                document.getElementById('office-latitude').value = e.latlng.lat.toFixed(6);
                document.getElementById('office-longitude').value = e.latlng.lng.toFixed(6);
            }
        });
    }

    /**
     * Get all offices
     * @returns {Promise<Array>} Offices
     */
    async getOffices() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/offices`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load offices');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting offices:', error);
            showAdminError(error.message);
            return [];
        }
    }

    /**
     * Get a specific office
     * @param {number} officeId - The office ID
     * @returns {Promise<Object>} Office details
     */
    async getOffice(officeId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/offices/${officeId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load office details');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error getting office ${officeId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Create a new office
     * @param {Object} officeData - The office data
     * @returns {Promise<Object>} Created office
     */
    async createOffice(officeData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/offices`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(officeData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create office');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating office:', error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Update an office
     * @param {number} officeId - The office ID
     * @param {Object} officeData - The office data
     * @returns {Promise<Object>} Updated office
     */
    async updateOffice(officeId, officeData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/offices/${officeId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(officeData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update office');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error updating office ${officeId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Delete an office
     * @param {number} officeId - The office ID
     * @returns {Promise<void>}
     */
    async deleteOffice(officeId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/offices/${officeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete office');
            }
        } catch (error) {
            console.error(`Error deleting office ${officeId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Load offices data from the API and display on map
     */
    async loadOffices() {
        try {
            const offices = await this.getOffices();
            
            // Clear existing markers
            this.clearOfficeMarkers();
            
            // Add new markers for each office
            offices.forEach(office => {
                this.addOfficeMarker(office);
            });
            
            // Fit map to show all offices
            if (this.geofenceCircles.length > 0) {
                const featureGroup = L.featureGroup(this.geofenceCircles);
                this.map.fitBounds(featureGroup.getBounds());
            }
            
            return offices;
        } catch (error) {
            console.error('Error loading offices:', error);
            showAdminError(error.message);
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
        
        marker.bindPopup(`
            <b>${office.name}</b><br>
            ${office.address}<br>
            Radius: ${office.radius}m<br>
            <button class="popup-edit-office" data-id="${office.id}">Edit</button>
        `);
        
        // Store office data with the marker
        marker.office = office;
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
        
        // Set up popup content event handling
        marker.on('popupopen', () => {
            const editButton = document.querySelector(`.popup-edit-office[data-id="${office.id}"]`);
            if (editButton) {
                editButton.addEventListener('click', () => {
                    this.openEditOfficeModal(office.id);
                });
            }
        });
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
    }

    /**
     * Load offices into table
     */
    async loadOfficesTable() {
        const offices = await this.getOffices();
        const tableBody = document.getElementById('offices-table-body');
        tableBody.innerHTML = '';
        
        offices.forEach(office => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${office.id}</td>
                <td>${office.name}</td>
                <td>${office.address}</td>
                <td>(${office.latitude.toFixed(6)}, ${office.longitude.toFixed(6)})</td>
                <td>${office.radius}</td>
                <td class="table-actions">
                    <button class="btn btn-primary edit-office" data-id="${office.id}">Edit</button>
                    <button class="btn btn-danger delete-office" data-id="${office.id}">Delete</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-office').forEach(button => {
            button.addEventListener('click', () => this.openEditOfficeModal(button.dataset.id));
        });
        
        document.querySelectorAll('.delete-office').forEach(button => {
            button.addEventListener('click', () => this.confirmDeleteOffice(button.dataset.id));
        });
    }

    /**
     * Open the office modal for creating a new office
     */
    openAddOfficeModal() {
        // Reset form
        document.getElementById('office-form').reset();
        document.getElementById('office-id').value = '';
        
        // Set default radius
        document.getElementById('office-radius').value = CONFIG.GEOFENCE_RADIUS_METERS;
        
        // Update modal title
        document.getElementById('office-modal-title').textContent = 'Add Office';
        
        // Show modal
        document.getElementById('modal-backdrop').style.display = 'block';
        document.getElementById('office-modal').style.display = 'block';
    }

    /**
     * Open the office modal for editing an existing office
     * @param {string} officeId - The office ID
     */
    async openEditOfficeModal(officeId) {
        try {
            const office = await this.getOffice(officeId);
            
            // Fill form with office data
            document.getElementById('office-id').value = office.id;
            document.getElementById('office-name').value = office.name;
            document.getElementById('office-address').value = office.address;
            document.getElementById('office-latitude').value = office.latitude;
            document.getElementById('office-longitude').value = office.longitude;
            document.getElementById('office-radius').value = office.radius;
            
            // Update modal title
            document.getElementById('office-modal-title').textContent = 'Edit Office';
            
            // Show modal
            document.getElementById('modal-backdrop').style.display = 'block';
            document.getElementById('office-modal').style.display = 'block';
            
            // Center map on office
            if (this.map) {
                this.map.setView([office.latitude, office.longitude], 15);
            }
        } catch (error) {
            showAdminError(`Error loading office: ${error.message}`);
        }
    }

    /**
     * Save office data (create or update)
     * @param {Event} event - Form submission event
     */
    async saveOffice(event) {
        event.preventDefault();
        
        const officeId = document.getElementById('office-id').value;
        const officeData = {
            name: document.getElementById('office-name').value,
            address: document.getElementById('office-address').value,
            latitude: parseFloat(document.getElementById('office-latitude').value),
            longitude: parseFloat(document.getElementById('office-longitude').value),
            radius: parseFloat(document.getElementById('office-radius').value),
        };
        
        try {
            if (officeId) {
                // Update existing office
                await this.updateOffice(officeId, officeData);
                showAdminError('Office updated successfully!');
            } else {
                // Create new office
                await this.createOffice(officeData);
                showAdminError('Office created successfully!');
            }
            
            // Close modal
            document.getElementById('modal-backdrop').style.display = 'none';
            document.getElementById('office-modal').style.display = 'none';
            
            // Reload offices
            await this.loadOffices();
            await this.loadOfficesTable();
        } catch (error) {
            showAdminError(`Error saving office: ${error.message}`);
        }
    }

    /**
     * Show confirmation dialog for deleting an office
     * @param {string} officeId - The office ID
     */
    async confirmDeleteOffice(officeId) {
        try {
            const office = await this.getOffice(officeId);
            
            const confirmMessage = document.getElementById('confirm-message');
            confirmMessage.textContent = `Are you sure you want to delete the office "${office.name}"? This action cannot be undone.`;
            
            const confirmYesButton = document.getElementById('confirm-yes');
            confirmYesButton.onclick = async () => {
                try {
                    await this.deleteOffice(officeId);
                    
                    // Close modal
                    document.getElementById('confirm-modal').style.display = 'none';
                    document.getElementById('modal-backdrop').style.display = 'none';
                    
                    // Reload offices
                    await this.loadOffices();
                    await this.loadOfficesTable();
                    
                    showAdminError('Office deleted successfully!');
                } catch (error) {
                    showAdminError(`Error deleting office: ${error.message}`);
                }
            };
            
            // Show modal
            document.getElementById('modal-backdrop').style.display = 'block';
            document.getElementById('confirm-modal').style.display = 'block';
        } catch (error) {
            showAdminError(`Error loading office: ${error.message}`);
        }
    }

    /**
     * Initialize office section
     */
    initOfficeSection() {
        // Set up add office button
        const addOfficeButton = document.createElement('button');
        addOfficeButton.className = 'btn btn-primary';
        addOfficeButton.textContent = 'Add Office';
        addOfficeButton.addEventListener('click', () => this.openAddOfficeModal());
        
        document.getElementById('section-actions').innerHTML = '';
        document.getElementById('section-actions').appendChild(addOfficeButton);
        
        // Initialize map
        this.initMap();
        
        // Load offices table
        this.loadOfficesTable();
        
        // Set up office form submission
        const officeForm = document.getElementById('office-form');
        officeForm.addEventListener('submit', (e) => this.saveOffice(e));
    }
}

// Create a global instance of the office service
const officeService = new OfficeService();