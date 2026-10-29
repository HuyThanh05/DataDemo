CREATE TABLE dataset_column_settings (
    column_id BIGINT PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    allowed_aggregations VARCHAR(100) NOT NULL,
    default_aggregation VARCHAR(10) NULL,
    CONSTRAINT fk_column_settings FOREIGN KEY (column_id) REFERENCES dataset_columns(id) ON DELETE CASCADE
);
INSERT INTO dataset_column_settings(column_id,role,allowed_aggregations,default_aggregation)
SELECT id, CASE WHEN can_aggregate THEN 'MEASURE' ELSE 'DIMENSION' END,
       CASE WHEN can_aggregate THEN 'COUNT,SUM,AVG,MIN,MAX' ELSE 'COUNT' END,
       CASE WHEN can_aggregate THEN 'AVG' ELSE 'COUNT' END
FROM dataset_columns;
