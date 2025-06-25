# Allied HRMS portal

This is the basic outlay of the HRMS portal that is to be developed. Currently the main features of this are Geofencing based attendance, and a robust admin portal for the addition of homes and offices. The admin can also view the different attendances and logins. There is an autologout scheduler for every 2 hours, which will logout a logged in user within 2 hours, so the user has to login every 2 hours.

The main configurations are in the config file in the backend, and the config.js file for the frontend. Most of the settings are centralised through these files.

The current authentication system is through jwt as well as ldap (needs some configuration fixes). The other modifications can be done through the respective labeled files. For sql changes and data handling the main responsible files are base.py, models.py, schemas.py, these main factors of db communication are used everywhere in the code. 

As of right now, ldap and all authentication is unbinded, and anybody can log in, (needs fixing, havent been able to fix it due to wifi issue). For deployment, use IIS and nssm on the vm server.

Please update all new code through github and manage a proper repo through that.

I have explained the rest of the code to Krithika, please consult her for further queries.

### Basic File Structure

hrmsbuildv1:.
│   .gitignore
│   LICENSE
│   README.md
│   
├───.vscode
│       settings.json
│
└───hrms_app_dev
    ├───backend
    │   │   admin.py
    │   │   poetry.lock
    │   │   pyproject.toml
    │   │   README.md
    │   │
    │   └───app
    │       │   .env
    │       │   config.py
    │       │   logger.py
    │       │   main.py
    │       │
    │       ├───api
    │       │   │   addresses.py
    │       │   │   admin.py
    │       │   │   attendance.py
    │       │   │   auth.py
    │       │   │   offices.py
    │       │
    │       ├───core
    │       │   │   auth.py
    │       │   │   geofence.py
    │       │   │   ldap.py
    │       │   │   scheduler.py
    │       │
    │       ├───db
    │       │   │   base.py
    │       │
    │       ├───models
    │       │   │   models.py
    │       │
    │       ├───schemas
    │       │   │   schemas.py
    │
    └───frontend
        │   admin.html
        │   index.html
        │   web.config
        │
        ├───css
        │       admin.css
        │       styles.css
        │
        └───js
            │   app.js
            │   attendance.js
            │   auth.js
            │   config.js
            │   location.js
            │
            └───admin
                    admin-activity.js
                    admin-auth.js
                    admin-dashboard.js
                    admin-homeaddresses.js
                    admin-offices.js
                    admin-users.js
                    admin.js
