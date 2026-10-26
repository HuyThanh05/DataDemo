CREATE TABLE dashboard_charts (
    dashboard_id BIGINT NOT NULL,
    chart_id BIGINT NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dashboard_id, chart_id),
    CONSTRAINT fk_dashboard_chart_dashboard FOREIGN KEY (dashboard_id) REFERENCES dashboards(id),
    CONSTRAINT fk_dashboard_chart_chart FOREIGN KEY (chart_id) REFERENCES charts(id)
);
