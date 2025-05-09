/**
 * Main admin panel initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is an admin
    if (!AdminAuthService.checkAdminAuth()) {
        return;
    }
    
    // Update admin UI based on privileges
    AdminAuthService.updateAdminUI();
    
    // Initialize navigation
    initNavigation();
    
    // Initialize modal close handlers
    initModalHandlers();
    
    // Initialize logout functionality
    document.getElementById('admin-logout').addEventListener('click', () => {
        AuthService.logout();
    });
    
    // Initialize dashboard (default section)
    await DashboardService.initDashboard();
    
    // Initialize form handlers
    initFormHandlers();
    
    // Log initialization for debugging
    console.log('Admin panel initialized successfully');
});

/**
 * Initialize navigation functionality
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Get section to show
            const sectionId = link.dataset.section;
            
            // Log section change for debugging
            console.log(`Changing to section: ${sectionId}`);
            
            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update section title
            document.getElementById('section-title').textContent = link.textContent;
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            const selectedSection = document.getElementById(`${sectionId}-section`);
            selectedSection.classList.add('active');
            
            // Clear action buttons
            document.getElementById('section-actions').innerHTML = '';
            
            // Initialize section content
            switch (sectionId) {
                case 'dashboard':
                    await DashboardService.initDashboard();
                    break;
                case 'users':
                    UserService.initUserSection();
                    break;
                case 'offices':
                    officeService.initOfficeSection();
                    break;
                case 'activity':
                    await ActivityService.initActivitySection();
                    break;
                case 'admins':
                    UserService.initAdminSection();
                    break;
            }
        });
    });
}

/**
 * Initialize form handlers for all modals
 */
function initFormHandlers() {
    // User form submission
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', UserService.saveUser);
        console.log('User form handler initialized');
    }
    
    // Office form submission
    const officeForm = document.getElementById('office-form');
    if (officeForm) {
        officeForm.addEventListener('submit', (e) => officeService.saveOffice(e));
        console.log('Office form handler initialized');
    }
}

/**
 * Initialize modal handlers
 */
function initModalHandlers() {
    // Close modals when clicking on backdrop or close button
    document.getElementById('modal-backdrop').addEventListener('click', closeAllModals);
    
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Prevent modal content clicks from closing the modal
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
    
    console.log('Modal handlers initialized');
}

/**
 * Close all modals
 */
function closeAllModals() {
    document.getElementById('modal-backdrop').style.display = 'none';
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}