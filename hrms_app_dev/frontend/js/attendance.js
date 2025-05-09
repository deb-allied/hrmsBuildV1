/**
 * Attendance tracking functionality
 */
class AttendanceService {
    /**
     * Get the current attendance status
     * @returns {Promise<Object|null>} The attendance status or null if not checked in
     */
    static async getCurrentStatus() {
        try {
            if (!AuthService.isAuthenticated()) {
                return null;
            }
            
            const response = await fetch(`${CONFIG.API_URL}/attendance/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            // If 404, user is not checked in (this is normal)
            if (response.status === 404) {
                return null;
            }
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get attendance status');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting attendance status:', error);
            // Only show error if it's not a 404 (not checked in)
            if (!error.message.includes('404')) {
                showError(error.message);
            }
            return null;
        }
    }

    /**
     * Get attendance history
     * @returns {Promise<Array>} Attendance records
     */
    static async getHistory() {
        try {
            if (!AuthService.isAuthenticated()) {
                return [];
            }
            
            const response = await fetch(`${CONFIG.API_URL}/attendance/history`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get attendance history');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting attendance history:', error);
            showError(error.message);
            return [];
        }
    }

    /**
     * Check in at the current location
     * @param {number} officeId - The office ID
     * @param {number} latitude - The latitude
     * @param {number} longitude - The longitude
     * @returns {Promise<Object>} The attendance record
     */
    static async checkIn(officeId, latitude, longitude) {
        try {
            if (!AuthService.isAuthenticated()) {
                throw new Error('You must be logged in');
            }
            
            const response = await fetch(`${CONFIG.API_URL}/attendance/check-in`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    office_id: officeId,
                    latitude,
                    longitude
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Check-in failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Check-in error:', error);
            showError(error.message);
            throw error;
        }
    }

    /**
     * Check out from the current location
     * @param {number} latitude - The latitude
     * @param {number} longitude - The longitude
     * @returns {Promise<Object>} The attendance record
     */
    static async checkOut(latitude, longitude) {
        try {
            if (!AuthService.isAuthenticated()) {
                throw new Error('You must be logged in');
            }
            
            const response = await fetch(`${CONFIG.API_URL}/attendance/check-out`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    latitude,
                    longitude
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Check-out failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Check-out error:', error);
            showError(error.message);
            throw error;
        }
    }

    /**
     * Update the UI with attendance status
     * @param {Object} status - The attendance status
     */
    static updateStatusUI(status) {
        const statusElement = document.getElementById('current-status');
        const checkInBtn = document.getElementById('check-in-btn');
        const checkOutBtn = document.getElementById('check-out-btn');
        
        if (status) {
            // User is checked in
            const checkInTime = formatTime(status.check_in_time);
            statusElement.textContent = `Checked in at ${checkInTime}`;
            statusElement.style.color = '#2ecc71'; // Green
            
            // Enable check-out button, disable check-in button
            checkInBtn.disabled = true;
            checkOutBtn.disabled = false;
        } else {
            // User is not checked in
            statusElement.textContent = 'Not checked in';
            statusElement.style.color = '#e74c3c'; // Red
            
            // Enable check-in button (if within geofence), disable check-out button
            checkInBtn.disabled = false;
            checkOutBtn.disabled = true;
            
            // Location service will update check-in button based on geofence status
            if (locationService.currentPosition) {
                const { latitude, longitude } = locationService.currentPosition.coords;
                locationService.checkGeofenceStatus(latitude, longitude);
            }
        }
    }

    /**
     * Update the attendance history table
     * @param {Array} records - The attendance records
     */
    static updateHistoryTable(records) {
        const tableBody = document.getElementById('history-body');
        tableBody.innerHTML = '';
        
        if (records.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" style="text-align: center;">No attendance records</td>';
            tableBody.appendChild(row);
            return;
        }
        
        records.forEach(record => {
            const row = document.createElement('tr');
            
            // Format dates and times
            const date = formatDate(record.check_in_time);
            const checkInTime = formatTime(record.check_in_time);
            const checkOutTime = record.check_out_time ? formatTime(record.check_out_time) : '-';
            const duration = calculateDuration(record.check_in_time, record.check_out_time);
            
            row.innerHTML = `
                <td>${date}</td>
                <td>Office #${record.office_id}</td>
                <td>${checkInTime}</td>
                <td>${checkOutTime}</td>
                <td>${duration}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
}

// DOM event listeners for attendance elements
document.addEventListener('DOMContentLoaded', () => {
    // Check-in button
    document.getElementById('check-in-btn').addEventListener('click', async () => {
        try {
            // Get current location
            await locationService.locateUser();
            if (!locationService.currentPosition) {
                throw new Error('Unable to get your location');
            }
            
            const { latitude, longitude } = locationService.currentPosition.coords;
            
            // Get nearest office (that user is within)
            const geofenceResults = await locationService.checkGeofenceStatus(latitude, longitude);
            const withinGeofence = geofenceResults.filter(result => result.is_within_geofence);
            
            if (withinGeofence.length === 0) {
                throw new Error('You must be within an office geofence to check in');
            }
            
            // Use the nearest office that user is within
            const office = withinGeofence.reduce((nearest, current) => {
                return (!nearest || current.distance < nearest.distance) ? current : nearest;
            }, null);
            
            // Check in
            await AttendanceService.checkIn(office.office_id, latitude, longitude);
            
            // Update UI
            const status = await AttendanceService.getCurrentStatus();
            AttendanceService.updateStatusUI(status);
            
            // Refresh history
            const history = await AttendanceService.getHistory();
            AttendanceService.updateHistoryTable(history);
            
            showError('Checked in successfully!');
        } catch (error) {
            showError(error.message);
        }
    });

    // Check-out button
    document.getElementById('check-out-btn').addEventListener('click', async () => {
        try {
            // Get current location
            await locationService.locateUser();
            if (!locationService.currentPosition) {
                throw new Error('Unable to get your location');
            }
            
            const { latitude, longitude } = locationService.currentPosition.coords;
            
            // Check out
            await AttendanceService.checkOut(latitude, longitude);
            
            // Update UI
            AttendanceService.updateStatusUI(null);
            
            // Refresh history
            const history = await AttendanceService.getHistory();
            AttendanceService.updateHistoryTable(history);
            
            showError('Checked out successfully!');
        } catch (error) {
            showError(error.message);
        }
    });
});