/**
 * Admin user management functionality
 */
class UserService {
    /**
     * Get all users
     * @returns {Promise<Array>} Users
     */
    static async getUsers() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/admin/users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load users');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting users:', error);
            showAdminError(error.message);
            return [];
        }
    }

    /**
     * Get a specific user
     * @param {number} userId - The user ID
     * @returns {Promise<Object>} User details
     */
    static async getUser(userId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load user details');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error getting user ${userId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Create a new user
     * @param {Object} userData - The user data
     * @returns {Promise<Object>} Created user
     */
    static async createUser(userData) {
        try {
            console.log('Creating user with data:', userData);
            const response = await fetch(`${CONFIG.API_URL}/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create user');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating user:', error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Update a user
     * @param {number} userId - The user ID
     * @param {Object} userData - The user data
     * @returns {Promise<Object>} Updated user
     */
    static async updateUser(userId, userData) {
        try {
            console.log(`Updating user ${userId} with data:`, userData);
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update user');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error updating user ${userId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Delete a user
     * @param {number} userId - The user ID
     * @returns {Promise<void>}
     */
    static async deleteUser(userId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${AuthService.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete user');
            }
        } catch (error) {
            console.error(`Error deleting user ${userId}:`, error);
            showAdminError(error.message);
            throw error;
        }
    }

    /**
     * Load users into table
     */
    static async loadUsersTable() {
        const users = await UserService.getUsers();
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            const roleText = user.is_super_admin ? 'Super Admin' : 
                             user.is_admin ? 'Admin' : 'User';
            
            const roleClass = user.is_super_admin ? 'badge-warning' : 
                              user.is_admin ? 'badge-primary' : '';
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.full_name || '-'}</td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <span class="badge ${roleClass}">
                        ${roleText}
                    </span>
                </td>
                <td>${user.last_login ? formatTime(user.last_login) : 'Never'}</td>
                <td class="table-actions">
                    <button class="btn btn-primary edit-user" data-id="${user.id}">Edit</button>
                    <button class="btn btn-danger delete-user" data-id="${user.id}" ${user.is_super_admin ? 'disabled' : ''}>Delete</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-user').forEach(button => {
            button.addEventListener('click', () => UserService.openEditUserModal(button.dataset.id));
        });
        
        document.querySelectorAll('.delete-user').forEach(button => {
            button.addEventListener('click', () => UserService.confirmDeleteUser(button.dataset.id));
        });
    }

    /**
     * Load admin users into admin management table
     */
    static async loadAdminsTable() {
        const users = await UserService.getUsers();
        const tableBody = document.getElementById('admins-table-body');
        tableBody.innerHTML = '';
        
        // Filter admin users
        const adminUsers = users.filter(user => user.is_admin || user.is_super_admin);
        
        adminUsers.forEach(user => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.full_name || '-'}</td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.is_super_admin ? 'badge-warning' : 'badge-primary'}">
                        ${user.is_super_admin ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>${user.last_login ? formatTime(user.last_login) : 'Never'}</td>
                <td class="table-actions">
                    <button class="btn btn-primary edit-admin" data-id="${user.id}">Edit</button>
                    ${!user.is_super_admin ? `<button class="btn btn-danger delete-admin" data-id="${user.id}">Remove Admin</button>` : ''}
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-admin').forEach(button => {
            button.addEventListener('click', () => UserService.openEditUserModal(button.dataset.id));
        });
        
        document.querySelectorAll('.delete-admin').forEach(button => {
            button.addEventListener('click', () => UserService.confirmRemoveAdmin(button.dataset.id));
        });
    }

    /**
     * Open the user modal for creating a new user
     */
    static openAddUserModal() {
        // Reset form
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-password').required = true;
        
        // Update modal title
        document.getElementById('user-modal-title').textContent = 'Add User';
        
        // Show/hide admin option based on super admin status
        const adminField = document.getElementById('user-admin-group');
        adminField.style.display = AdminAuthService.isSuperAdmin() ? 'block' : 'none';
        
        // Show modal
        document.getElementById('modal-backdrop').style.display = 'block';
        document.getElementById('user-modal').style.display = 'block';
    }

    /**
     * Open the user modal for editing an existing user
     * @param {string} userId - The user ID
     */
    static async openEditUserModal(userId) {
        try {
            const user = await UserService.getUser(userId);
            
            // Fill form with user data
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-email').value = user.email;
            document.getElementById('user-fullname').value = user.full_name || '';
            document.getElementById('user-active').value = user.is_active.toString();
            document.getElementById('user-admin').value = user.is_admin.toString();
            
            // Password is optional when editing
            document.getElementById('user-password').required = false;
            document.getElementById('user-password').value = '';
            
            // Update modal title
            document.getElementById('user-modal-title').textContent = 'Edit User';
            
            // Show/hide admin option based on super admin status
            const adminField = document.getElementById('user-admin-group');
            adminField.style.display = AdminAuthService.isSuperAdmin() ? 'block' : 'none';
            
            // Disable admin field for super admin users (can't demote super admins)
            const adminSelect = document.getElementById('user-admin');
            adminSelect.disabled = user.is_super_admin;
            
            // Show modal
            document.getElementById('modal-backdrop').style.display = 'block';
            document.getElementById('user-modal').style.display = 'block';
        } catch (error) {
            showAdminError(`Error loading user: ${error.message}`);
        }
    }

    /**
     * Save user data (create or update)
     * @param {Event} event - Form submission event
     */
    static async saveUser(event) {
        event.preventDefault();
        
        const userId = document.getElementById('user-id').value;
        const userData = {
            username: document.getElementById('user-username').value,
            email: document.getElementById('user-email').value,
            full_name: document.getElementById('user-fullname').value || undefined,
            is_active: document.getElementById('user-active').value === 'true',
        };
        
        // Include password only if provided
        const password = document.getElementById('user-password').value;
        if (password) {
            userData.password = password;
        }
        
        // Include admin status only if user is super admin
        if (AdminAuthService.isSuperAdmin()) {
            userData.is_admin = document.getElementById('user-admin').value === 'true';
        }
        
        try {
            if (userId) {
                // Update existing user
                await UserService.updateUser(userId, userData);
                showAdminError('User updated successfully!');
            } else {
                // Create new user
                if (!password) {
                    throw new Error('Password is required for new users');
                }
                await UserService.createUser(userData);
                showAdminError('User created successfully!');
            }
            
            // Close modal
            document.getElementById('modal-backdrop').style.display = 'none';
            document.getElementById('user-modal').style.display = 'none';
            
            // Reload user tables
            await UserService.loadUsersTable();
            if (document.getElementById('admins-table-body')) {
                await UserService.loadAdminsTable();
            }
        } catch (error) {
            showAdminError(`Error saving user: ${error.message}`);
        }
    }

    /**
     * Show confirmation dialog for deleting a user
     * @param {string} userId - The user ID
     */
    static confirmDeleteUser(userId) {
        const confirmMessage = document.getElementById('confirm-message');
        confirmMessage.textContent = 'Are you sure you want to delete this user? This action cannot be undone.';
        
        const confirmYesButton = document.getElementById('confirm-yes');
        confirmYesButton.onclick = async () => {
            try {
                await UserService.deleteUser(userId);
                
                // Close modal
                document.getElementById('confirm-modal').style.display = 'none';
                document.getElementById('modal-backdrop').style.display = 'none';
                
                // Reload user tables
                await UserService.loadUsersTable();
                if (document.getElementById('admins-table-body')) {
                    await UserService.loadAdminsTable();
                }
                
                showAdminError('User deleted successfully!');
            } catch (error) {
                showAdminError(`Error deleting user: ${error.message}`);
            }
        };
        
        // Show modal
        document.getElementById('modal-backdrop').style.display = 'block';
        document.getElementById('confirm-modal').style.display = 'block';
    }

    /**
     * Show confirmation dialog for removing admin privileges
     * @param {string} userId - The user ID
     */
    static async confirmRemoveAdmin(userId) {
        try {
            const user = await UserService.getUser(userId);
            
            const confirmMessage = document.getElementById('confirm-message');
            confirmMessage.textContent = `Are you sure you want to remove admin privileges from ${user.username}?`;
            
            const confirmYesButton = document.getElementById('confirm-yes');
            confirmYesButton.onclick = async () => {
                try {
                    // Update user to remove admin privileges
                    await UserService.updateUser(userId, { is_admin: false });
                    
                    // Close modal
                    document.getElementById('confirm-modal').style.display = 'none';
                    document.getElementById('modal-backdrop').style.display = 'none';
                    
                    // Reload admin table
                    await UserService.loadAdminsTable();
                    
                    showAdminError('Admin privileges removed successfully!');
                } catch (error) {
                    showAdminError(`Error removing admin privileges: ${error.message}`);
                }
            };
            
            // Show modal
            document.getElementById('modal-backdrop').style.display = 'block';
            document.getElementById('confirm-modal').style.display = 'block';
        } catch (error) {
            showAdminError(`Error loading user: ${error.message}`);
        }
    }

    /**
     * Initialize user section
     */
    static initUserSection() {
        // Set up add user button
        const addUserButton = document.createElement('button');
        addUserButton.className = 'btn btn-primary';
        addUserButton.textContent = 'Add User';
        addUserButton.addEventListener('click', UserService.openAddUserModal);
        
        document.getElementById('section-actions').innerHTML = '';
        document.getElementById('section-actions').appendChild(addUserButton);
        
        // Load users table
        UserService.loadUsersTable();
        
        // Set up user form submission
        const userForm = document.getElementById('user-form');
        userForm.addEventListener('submit', UserService.saveUser);
    }

    /**
     * Initialize admin management section
     */
    static initAdminSection() {
        // Only super admin can add admins
        if (AdminAuthService.isSuperAdmin()) {
            const addAdminButton = document.createElement('button');
            addAdminButton.className = 'btn btn-primary';
            addAdminButton.textContent = 'Add Admin';
            addAdminButton.addEventListener('click', () => {
                UserService.openAddUserModal();
                // Set admin to true by default for this form
                document.getElementById('user-admin').value = 'true';
            });
            
            document.getElementById('section-actions').innerHTML = '';
            document.getElementById('section-actions').appendChild(addAdminButton);
        }
        
        // Load admins table
        UserService.loadAdminsTable();
    }
}