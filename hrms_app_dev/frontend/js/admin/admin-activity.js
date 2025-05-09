/**
 * Admin activity log functionality
 */
class ActivityService {
    /**
     * Get login history
     * @param {number} userId - Optional user ID to filter by
     * @param {number} limit - Maximum number of records to return
     * @returns {Promise<Array>} Login history records
     */
    static async getLoginHistory(userId = null, limit = 100) {
        try {
            let url = `${CONFIG.API_URL}/admin/login-history?limit=${limit}`;
            
            if (userId) {
                url += `&user_id=${userId}`;
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load login history');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting login history:', error);
            showAdminError(error.message);
            return [];
        }
    }

    /**
     * Get attendance records
     * @param {number} userId - Optional user ID to filter by
     * @param {number} limit - Maximum number of records to return
     * @returns {Promise<Array>} Attendance records
     */
    static async getAttendanceRecords(userId = null, limit = 100) {
        try {
            let url = `${CONFIG.API_URL}/attendance/history?limit=${limit}`;
            
            // Note: This assumes backend supports filtering by user_id
            // You may need to implement this filter on the backend
            if (userId) {
                url += `&user_id=${userId}`;
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load attendance records');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting attendance records:', error);
            showAdminError(error.message);
            return [];
        }
    }

    /**
     * Load activity log data
     * @param {string} activityType - Type of activity to load ('login', 'attendance', or empty for all)
     * @param {number} userId - Optional user ID to filter by
     */
    static async loadActivityLog(activityType = '', userId = null) {
        try {
            // Get users for mapping IDs to names
            const users = await UserService.getUsers();
            const userMap = {};
            
            users.forEach(user => {
                userMap[user.id] = user.username;
            });
            
            let activities = [];
            
            // Load login history if needed
            if (!activityType || activityType === 'login') {
                const loginHistory = await ActivityService.getLoginHistory(userId);
                
                activities = [
                    ...activities,
                    ...loginHistory.map(login => ({
                        type: 'login',
                        user_id: login.user_id,
                        username: userMap[login.user_id] || `User #${login.user_id}`,
                        start_time: new Date(login.login_time),
                        end_time: login.logout_time ? new Date(login.logout_time) : null,
                        duration: login.logout_time ? 
                            calculateDuration(login.login_time, login.logout_time) : 
                            'Active',
                        details: `IP: ${login.ip_address || 'Unknown'}`,
                        raw: login
                    }))
                ];
            }
            
            // Load attendance records if needed
            if (!activityType || activityType === 'attendance') {
                const attendanceRecords = await ActivityService.getAttendanceRecords(userId);
                
                activities = [
                    ...activities,
                    ...attendanceRecords.map(record => ({
                        type: 'attendance',
                        user_id: record.user_id,
                        username: userMap[record.user_id] || `User #${record.user_id}`,
                        start_time: new Date(record.check_in_time),
                        end_time: record.check_out_time ? new Date(record.check_out_time) : null,
                        duration: record.check_out_time ? 
                            calculateDuration(record.check_in_time, record.check_out_time) : 
                            'Active',
                        details: `Office #${record.office_id}`,
                        raw: record
                    }))
                ];
            }
            
            // Sort by start time (most recent first)
            activities.sort((a, b) => b.start_time - a.start_time);
            
            // Update table
            const tableBody = document.getElementById('activity-table-body');
            tableBody.innerHTML = '';
            
            if (activities.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="6" style="text-align: center;">No activity records found</td>';
                tableBody.appendChild(row);
                return;
            }
            
            activities.forEach(activity => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${activity.username}</td>
                    <td>
                        <span class="badge ${activity.type === 'login' ? 'badge-primary' : 'badge-success'}">
                            ${activity.type === 'login' ? 'Login' : 'Attendance'}
                        </span>
                    </td>
                    <td>${formatDate(activity.start_time)} ${formatTime(activity.start_time)}</td>
                    <td>${activity.end_time ? `${formatDate(activity.end_time)} ${formatTime(activity.end_time)}` : '-'}</td>
                    <td>${activity.duration}</td>
                    <td>${activity.details}</td>
                `;
                
                tableBody.appendChild(row);
            });
            
            return activities;
        } catch (error) {
            console.error('Error loading activity log:', error);
            showAdminError(error.message);
        }
    }

    /**
     * Initialize user filter dropdown
     */
    static async initUserFilter() {
        try {
            const users = await UserService.getUsers();
            const userFilter = document.getElementById('activity-user-filter');
            
            // Clear existing options
            userFilter.innerHTML = '<option value="">All Users</option>';
            
            // Add user options
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username;
                userFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error initializing user filter:', error);
            showAdminError(error.message);
        }
    }

    /**
     * Initialize activity section
     */
    static async initActivitySection() {
        // Load user filter
        await ActivityService.initUserFilter();
        
        // Load initial activity data
        await ActivityService.loadActivityLog();
        
        // Set up filter controls
        document.getElementById('apply-filters').addEventListener('click', async () => {
            const userFilter = document.getElementById('activity-user-filter').value;
            const typeFilter = document.getElementById('activity-type-filter').value;
            
            await ActivityService.loadActivityLog(typeFilter, userFilter || null);
        });
    }
}