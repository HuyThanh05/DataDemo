-- Open in Workbench using root. Set your own password before running.
-- Creates a writer for application configuration only, not exam data.
CREATE USER IF NOT EXISTS 'datademo_app_user'@'localhost'
IDENTIFIED BY 'REPLACE_WITH_YOUR_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE
ON datademo_app.* TO 'datademo_app_user'@'localhost';
SHOW GRANTS FOR 'datademo_app_user'@'localhost';
