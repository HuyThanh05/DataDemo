CREATE TABLE dashboard_filters (
    dashboard_id BIGINT PRIMARY KEY,
    dataset_id BIGINT NOT NULL,
    column_name VARCHAR(64) NOT NULL,
    selected_value VARCHAR(500) NULL,
    CONSTRAINT fk_filter_dashboard FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
    CONSTRAINT fk_filter_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);
