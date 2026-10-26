CREATE TABLE datasets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    connection_id BIGINT NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dataset_connection FOREIGN KEY (connection_id) REFERENCES database_connections(id)
);

CREATE TABLE dataset_columns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dataset_id BIGINT NOT NULL,
    column_name VARCHAR(64) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(255) NOT NULL,
    is_nullable BOOLEAN NOT NULL,
    ordinal_position INT NOT NULL,
    can_group BOOLEAN NOT NULL,
    can_aggregate BOOLEAN NOT NULL,
    can_filter BOOLEAN NOT NULL,
    CONSTRAINT fk_column_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id),
    CONSTRAINT uq_dataset_column UNIQUE (dataset_id, column_name)
);
