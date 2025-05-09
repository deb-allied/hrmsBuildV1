/**
 * Admin dashboard functionality
 */
class DashboardService {
    /**
     * Load dashboard statistics
     */
    static async loadDashboardStats() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/admin/dashboard-stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load dashboard stats');
            }
            
            const stats = await response.json();
            
            // Update UI with stats
            document.getElementById('total-users').textContent = stats.users.total;
            document.getElementById('active-users').textContent = `${stats.users.active} active`;
            document.getElementById('admin-users').textContent = `${stats.users.admins} admins`;
            document.getElementById('total-offices').textContent = stats.offices.total;
            document.getElementById('today-attendance').textContent = stats.attendance.today;
            document.getElementById('active-logins').textContent = stats.logins.active;
            document.getElementById('today-logins').textContent = `${stats.logins.today} today`;
            
            return stats;
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            showAdminError(error.message);
        }
    }

    /**
     * Load recent activities
     */
    static async loadRecentActivity() {
        try {
            // Get login history
            const loginResponse = await fetch(`${CONFIG.API_URL}/admin/login-history?limit=5`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!loginResponse.ok) {
                const error = await loginResponse.json();
                throw new Error(error.detail || 'Failed to load login history');
            }
            
            const loginHistory = await loginResponse.json();
            
            // Get attendance records
            const attendanceResponse = await fetch(`${CONFIG.API_URL}/attendance/history?limit=5`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!attendanceResponse.ok) {
                const error = await attendanceResponse.json();
                throw new Error(error.detail || 'Failed to load attendance history');
            }
            
            const attendanceHistory = await attendanceResponse.json();
            
            // Get user data for mapping IDs to names
            const users = await UserService.getUsers();
            const userMap = {};
            
            users.forEach(user => {
                userMap[user.id] = user.username;
            });
            
            // Combine and sort activities
            const activities = [
                ...loginHistory.map(login => ({
                    type: 'login',
                    user_id: login.user_id,
                    username: userMap[login.user_id] || `User #${login.user_id}`,
                    time: new Date(login.login_time),
                    details: login.logout_time ? 'Logged out' : 'Currently logged in'
                })),
                ...attendanceHistory.map(record => ({
                    type: 'attendance',
                    user_id: record.user_id,
                    username: userMap[record.user_id] || `User #${record.user_id}`,
                    time: new Date(record.check_in_time),
                    details: record.check_out_time ? 'Checked out' : 'Currently checked in'
                }))
            ];
            
            // Sort by time (most recent first)
            activities.sort((a, b) => b.time - a.time);
            
            // Take only the first 10
            const recentActivities = activities.slice(0, 10);
            
            // Update UI
            const tableBody = document.getElementById('recent-activity-body');
            tableBody.innerHTML = '';
            
            recentActivities.forEach(activity => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${activity.username}</td>
                    <td>${activity.type === 'login' ? 'Login' : 'Attendance'}</td>
                    <td>${formatTime(activity.time)}</td>
                    <td>${activity.details}</td>
                `;
                tableBody.appendChild(row);
            });
            
            return recentActivities;
        } catch (error) {
            console.error('Error loading recent activity:', error);
            showAdminError(error.message);
        }
    }

    /**
     * Initialize dashboard
     */
    static async initDashboard() {
        await DashboardService.loadDashboardStats();
        await DashboardService.loadRecentActivity();
    }
}