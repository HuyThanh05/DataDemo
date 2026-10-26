-- No DROP, UPDATE or data rewrite: adopt the existing PoC table if present.
-- Database charset is configured when datademo_app is created (utf8mb4).
CREATE TABLE IF NOT EXISTS database_connections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    host VARCHAR(253) NOT NULL,
    port INT NOT NULL,
    database_name VARCHAR(64) NOT NULL,
    username VARCHAR(100) NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
