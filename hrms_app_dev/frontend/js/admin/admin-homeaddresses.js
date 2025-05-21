/**
 * Admin home address management functionality
 */
class HomeAddressService {
    constructor() {
        this.map = null;
        this.homeAddressMarkers = [];
        this.geofenceCircles = [];
    }

    /**
     * Initialize the admin map
     */
    initMap() {
        // Create the map centered at default location
        this.map = L.map('admin-map-home').setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        // Load home addresses
        this.loadHomeAddresses();

        // Set up map click event for picking coordinates
        this.map.on('click', (e) => {
            // If home address modal is open, update latitude and longitude fields
            if (document.getElementById('home-address-modal').style.display === 'block') {
                document.getElementById('home-address-latitude').value = e.latlng.lat.toFixed(6);
                document.getElementById('home-address-longitude').value = e.latlng.lng.toFixed(6);
            }
        });
    }

    /**
     * Get users home addresses
     * @param {number} userId - Optional user ID to filter by
     * @returns {Promise<Array>} Home Addresses
     */
    async getHomeAddresses(userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${effectiveUserId}/addresses`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load home addresses');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting home addresses:', error);
            showAdminError(error.message);
            return [];
        }
    }

    /**
     * Perform an authenticated fetch and return parsed JSON
     * @param {string} url 
     * @returns {Promise<any>}
     */
    async fetchAuthenticated(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthService.getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error(`Request to ${url} failed: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get a specific home address
     * @param {number} homeAddressId - The home address ID
     * @param {number} userId - Optional user ID to filter by
     * @returns {Promise<Object>} Home address details
     */
    async getHomeAddress(homeAddressId, userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }

            const response = await fetch(`${CONFIG.API_URL}/admin/users/${effectiveUserId}/addresses/${homeAddressId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load home address details');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error getting home address ${homeAddressId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Create a new home for a user address
     * @param {Object} homeAddressData - The home address data
     * @param {number} userId - The user ID
     * @returns {Promise<Object>} Created home address
     */
    async createHomeAddress(homeAddressData, userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }
            // Validate home address data
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${effectiveUserId}/addresses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(homeAddressData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create home address');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating home address:', error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Update a home address
     * @param {number} userId - The user ID
     * @param {number} homeAddressId - The home address ID
     * @param {Object} homeAddressData - The home address data
     * @returns {Promise<Object>} Updated home address
     */
    async updateHomeAddress(homeAddressId, homeAddressData, userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${effectiveUserId}/addresses/${homeAddressId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(homeAddressData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update home address');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error updating home address ${homeAddressId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Delete a home address
     * @param {number} homeAddressId - The home address ID
     * @param {number} userId - The user ID
     * @returns {Promise<void>}
     */
    async deleteHomeAddress(homeAddressId, userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${effectiveUserId}/addresses/${homeAddressId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete home address');
            }
        } catch (error) {
            console.error(`Error deleting home address ${homeAddressId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Load home addresses data from the API and display on map
     * @param {number} userId - Optional user ID to filter by
     */
    async loadHomeAddresses(userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }
            const homeAddresses = await this.getHomeAddresses(effectiveUserId);

            // Clear existing markers
            this.clearHomeAddressMarkers();

            // Add new markers for each home address
            homeAddresses.forEach(homeAddress => {
                this.addHomeAddressMarker(homeAddress);
            });

            // Fit map to show all home addresses
            if (this.geofenceCircles.length > 0) {
                const featureGroup = L.featureGroup(this.geofenceCircles);
                this.map.fitBounds(featureGroup.getBounds());
            }

            return homeAddresses;
        } catch (error) {
            console.error('Error loading home addresses:', error);
            showAdminError(error.message);
        }
    }

    /**
     * Add a home address marker to the map
     * @param {number} userId - The user ID
     * @param {Object} homeAddress - The home address data
     */
    addHomeAddressMarker(homeAddress, userId) {
        let effectiveUserId = userId;

        // if (!effectiveUserId) {
        //     const user = this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
        //     effectiveUserId = user.id;
        // }
        // Create home address marker
        const marker = L.marker([homeAddress.latitude, homeAddress.longitude], {
            icon: L.divIcon({
                className: 'home-address-marker',
                html: `<div style="background-color: ${CONFIG.HOME_ADDRESS_MARKER_COLOR}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [15, 15],
                iconAnchor: [7.5, 7.5]
            })
        }).addTo(this.map);
        
        marker.bindPopup(`
            <b>${homeAddress.name}</b><br>
            ${homeAddress.address}<br>
            Radius: ${CONFIG.GEOFENCE_HOME_RADIUS_METERS}m<br>
            <button class="popup-edit-home-address" data-id="${homeAddress.id}">Edit</button>
        `);
        
        // Store home address data with the marker
        marker.homeAddress = homeAddress;
        this.homeAddressMarkers.push(marker);
        
        // Create geofence circle
        const circle = L.circle([homeAddress.latitude, homeAddress.longitude], {
            radius: CONFIG.GEOFENCE_HOME_RADIUS_METERS,
            fillColor: CONFIG.GEOFENCE_COLOR,
            fillOpacity: CONFIG.GEOFENCE_OPACITY,
            color: CONFIG.GEOFENCE_COLOR,
            weight: 1
        }).addTo(this.map);

        // Store home address data with the circle
        circle.homeAddress = homeAddress;
        this.geofenceCircles.push(circle);
        
        // Set up popup content event handling
        marker.on('popupopen', () => {
            const editButton = document.querySelector(`.popup-edit-home-address[data-id="${homeAddress.id}"]`);
            if (editButton) {
                editButton.addEventListener('click', () => {
                    this.openEditHomeAddressModal(homeAddress.id, effectiveUserId);
                });
            }
        });
    }

    /**
     * Clear all home address markers from the map
     */
    clearHomeAddressMarkers() {
        // Remove markers
        this.homeAddressMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.homeAddressMarkers = [];

        // Remove geofence circles
        this.geofenceCircles.forEach(circle => {
            this.map.removeLayer(circle);
        });
        this.geofenceCircles = [];
    }

    /**
     * Load offices into table
     * @param {number} userId - Optional user ID to filter by
     * @returns {Promise<void>}
     */
    async loadHomeAddressesTable(userId) {
        let effectiveUserId = userId;

        if (!effectiveUserId) {
            const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
            effectiveUserId = user.id;
        }
        const homeAddresses = await this.getHomeAddresses(effectiveUserId);
        const tableBody = document.getElementById('home-addresses-table-body');
        tableBody.innerHTML = '';

        homeAddresses.forEach(homeAddress => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${homeAddress.id}</td>
                <td>${homeAddress.address_type}</td>
                <td>${homeAddress.address_line1}, ${homeAddress.address_line2}, ${homeAddress.city}, ${homeAddress.state}</td>
                <td>${homeAddress.country}</td>
                <td>${homeAddress.postal_code}</td>
                <td>(${homeAddress.latitude.toFixed(6)}, ${homeAddress.longitude.toFixed(6)})</td>
                <td class="table-actions">
                    <button class="btn btn-primary add-home-address" data-id="${homeAddress.id}">Add</button>
                    <button class="btn btn-primary edit-home-address" data-id="${homeAddress.id}">Edit</button>
                    <button class="btn btn-danger delete-home-address" data-id="${homeAddress.id}">Delete</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.add-home-address').forEach(button => {
            button.addEventListener('click', () => this.openAddHomeAddressModal(button.dataset.id, effectiveUserId));
        });

        document.querySelectorAll('.edit-home-address').forEach(button => {
            button.addEventListener('click', () => this.openEditHomeAddressModal(button.dataset.id, effectiveUserId));
        });
        
        document.querySelectorAll('.delete-home-address').forEach(button => {
            button.addEventListener('click', () => this.confirmDeleteHomeAddress(button.dataset.id, effectiveUserId));
        });
    }

    /**
     * Open the home address modal for creating a new home address
     */
    openAddHomeAddressModal() {
        // Reset form
        document.getElementById('home-address-form').reset();
        document.getElementById('home-address-id').value = '';
        
        // Set default radius
        document.getElementById('home-address-radius').value = CONFIG.GEOFENCE_HOME_RADIUS_METERS;
        
        // Update modal title
        document.getElementById('home-address-modal-title').textContent = 'Add Home Address';

        // Show modal
        document.getElementById('modal-backdrop').style.display = 'block';
        document.getElementById('home-address-modal').style.display = 'block';
    }

    /**
     * Open the home address modal for editing an existing home address
     * @param {string} userId - The user ID
     * @param {string} homeAddressId - The home address ID
     */
    async openEditHomeAddressModal(homeAddressId, userId) {
        try {
            let effectiveUserId = userId;

            if (!effectiveUserId) {
                const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
                effectiveUserId = user.id;
            }
            const homeAddress = await this.getHomeAddress(homeAddressId, effectiveUserId);

            // Fill form with home address data
            document.getElementById('home-address-id').value = homeAddress.id;
            document.getElementById('home-address-type').value = homeAddress.address_type;
            document.getElementById('home-address-line-1').value = homeAddress.address_line1;
            document.getElementById('home-address-line-2').value = homeAddress.address_line2;
            document.getElementById('home-address-city').value = homeAddress.city;
            document.getElementById('home-address-state').value = homeAddress.state;
            document.getElementById('home-address-country').value = homeAddress.country;
            document.getElementById('home-address-postal-code').value = homeAddress.postal_code;
            document.getElementById('home-address-latitude').value = homeAddress.latitude;
            document.getElementById('home-address-longitude').value = homeAddress.longitude;
            document.getElementById('home-address-is-current').value = homeAddress.is_current;

            // Update modal title
            document.getElementById('home-address-modal-title').textContent = 'Edit Home Address';

            // Show modal
            document.getElementById('modal-backdrop').style.display = 'block';
            document.getElementById('home-address-modal').style.display = 'block';

            // Center map on home address
            if (this.map) {
                this.map.setView([homeAddress.latitude, homeAddress.longitude], 15);
            }
        } catch (error) {
            showAdminError(`Error loading home address: ${error.message}`);
        }
    }

    /**
     * Save home address data (create or update)
     * @param {number} userId - The user ID
     * @param {Event} event - Form submission event
     */
    async saveHomeAddress(event, userId) {
        event.preventDefault();
        let effectiveUserId = userId;

        if (!effectiveUserId) {
            const user = await this.fetchAuthenticated(`${CONFIG.API_URL}/auth/me`);
            effectiveUserId = user.id;
        }
        const homeAddressId = document.getElementById('home-address-id').value;
        const homeAddressData = {
            address_type: document.getElementById('home-address-type').value,
            address_line1: document.getElementById('home-address-line-1').value,
            address_line2: document.getElementById('home-address-line-2').value,
            city: document.getElementById('home-address-city').value,
            state: document.getElementById('home-address-state').value,
            country: document.getElementById('home-address-country').value,
            postal_code: document.getElementById('home-address-postal-code').value,
            latitude: parseFloat(document.getElementById('home-address-latitude').value),
            longitude: parseFloat(document.getElementById('home-address-longitude').value),
            is_current: document.getElementById('home-address-is-current').value,
        };
        
        try {
            if (homeAddressId) {
                // Update existing home address
                await this.updateHomeAddress(homeAddressId, homeAddressData, effectiveUserId);
                showAdminError('Home Address updated successfully!');
            } else {
                // Create new home address
                await this.createHomeAddress(homeAddressData, effectiveUserId);
                showAdminError('Home Address created successfully!');
            }
            
            // Close modal
            document.getElementById('modal-backdrop').style.display = 'none';
            document.getElementById('home-address-modal').style.display = 'none';

            // Reload home addresses
            await this.loadHomeAddresses();
            await this.loadHomeAddressesTable();
        } catch (error) {
            showAdminError(`Error saving home address: ${error.message}`);
        }
    }

    /**
     * Show confirmation dialog for deleting a home address
     * @param {string} homeAddressId - The home address ID
     */
    async confirmDeleteHomeAddress(homeAddressId) {
        try {
            const homeAddress = await this.getHomeAddress(homeAddressId);

            const confirmMessage = document.getElementById('confirm-message');
            confirmMessage.textContent = `Are you sure you want to delete the home address "${homeAddress.name}"? This action cannot be undone.`;

            const confirmYesButton = document.getElementById('confirm-yes');
            confirmYesButton.onclick = async () => {
                try {
                    await this.deleteHomeAddress(homeAddressId);
                    showAdminError('Home Address deleted successfully!');
                    // Close modal
                    document.getElementById('confirm-modal').style.display = 'none';
                    document.getElementById('modal-backdrop').style.display = 'none';

                    // Reload home addresses
                    await this.loadHomeAddresses();
                    await this.loadHomeAddressesTable();

                    showAdminError('Home Address deleted successfully!');
                } catch (error) {
                    showAdminError(`Error deleting home address: ${error.message}`);
                }
            };
            
            // Show modal
            document.getElementById('modal-backdrop').style.display = 'block';
            document.getElementById('confirm-modal').style.display = 'block';
        } catch (error) {
            showAdminError(`Error loading home address: ${error.message}`);
        }
    }

    /**
     * Initialize user filter dropdown
     */
    async initUserFilter() {
        try {
            const users = await UserService.getUsers();
            const userFilter = document.getElementById('home-address-user-filter');

            // Clear existing options
            userFilter.innerHTML = '<option value="">All Users</option>';
            
            // Add user options
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.full_name;
                userFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error initializing user filter:', error);
            showAdminError(error.message);
        }
    }

    /**
     * Initialize home address section
     */
    
    initHomeAddressSection() {
        // Set up filter controls
        homeAddressService.initUserFilter();

        // Set up add home address button
        const addHomeAddressButton = document.createElement('button');
        addHomeAddressButton.className = 'btn btn-primary';
        addHomeAddressButton.textContent = 'Add Home Address';
        addHomeAddressButton.addEventListener('click', () => this.openAddHomeAddressModal());

        const sectionActions = document.getElementById('section-actions');
        sectionActions.innerHTML = '';
        sectionActions.appendChild(addHomeAddressButton);

        // Initialize map
        if (!this.map) {
            this.initMap();
        }

        // Load home addresses table (initial load - optionally with all users or current default user)
        // this.loadHomeAddressesTable();

        const userFilterInput = document.getElementById('home-address-user-filter');

        // Initialize selectedUserId from filter
        this.selectedUserId = userFilterInput.value;

        // Keep selectedUserId updated on change
        userFilterInput.addEventListener('change', () => {
            this.selectedUserId = userFilterInput.value;
            console.log(`User filter changed: selectedUserId = ${this.selectedUserId}`);
        });

        homeAddressService.loadHomeAddresses();
        homeAddressService.loadHomeAddressesTable();

        // Apply filter button
        document.getElementById('apply-filters').addEventListener('click', async () => {
            // selectedUserId is already synced via the change handler
            console.log(`Applying filters for selectedUserId = ${this.selectedUserId}`);

            await homeAddressService.loadHomeAddresses(this.selectedUserId);
            await homeAddressService.loadHomeAddressesTable(this.selectedUserId);
            // await homeAddressService.openEditHomeAddressModal(this.selectedUserId);
        });

        // Set up home address form submission
        const homeAddressForm = document.getElementById('home-address-form');
        homeAddressForm.addEventListener('submit', async(e) => this.saveHomeAddress(e, this.selectedUserId));

        console.log('Home address form handler initialized');
    }

}

// Create a global instance of the home address service
const homeAddressService = new HomeAddressService();