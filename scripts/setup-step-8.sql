-- Run once in MySQL Workbench as root before starting the backend with V2.
GRANT REFERENCES ON datademo_app.* TO 'datademo_app_user'@'localhost';
