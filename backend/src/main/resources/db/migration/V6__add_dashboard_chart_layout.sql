CREATE TABLE dashboard_chart_layouts (
    dashboard_id BIGINT NOT NULL,
    chart_id BIGINT NOT NULL,
    grid_x INT NOT NULL,
    grid_y INT NOT NULL,
    grid_w INT NOT NULL,
    grid_h INT NOT NULL,
    PRIMARY KEY (dashboard_id, chart_id),
    CONSTRAINT fk_layout_dashboard_chart FOREIGN KEY (dashboard_id, chart_id)
        REFERENCES dashboard_charts(dashboard_id, chart_id) ON DELETE CASCADE
);
