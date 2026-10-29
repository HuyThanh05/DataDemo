-- Preserve existing charts: a dimension with numeric calculations remains a measure.
UPDATE dataset_column_settings SET role='MEASURE'
WHERE role='DIMENSION' AND allowed_aggregations NOT IN ('','COUNT','COUNT_DISTINCT','COUNT,COUNT_DISTINCT','COUNT_DISTINCT,COUNT');
UPDATE dataset_column_settings
SET allowed_aggregations='COUNT,COUNT_DISTINCT', default_aggregation='COUNT'
WHERE role='DIMENSION';
