package com.datademo.backend.charts;

import java.util.List;

public final class ChartDtos {
    private ChartDtos() {}
    public record Filter(String column, String operator, String value) {}
    public record Request(Long datasetId, String chartType, String dimension, String aggregation,
                          String metricColumn, String sortDirection, List<Filter> filters, Bucket bucket) {
        public Request(Long datasetId, String chartType, String dimension, String aggregation, String metricColumn, String sortDirection, List<Filter> filters) {
            this(datasetId,chartType,dimension,aggregation,metricColumn,sortDirection,filters,null);
        }
    }
    public record Bucket(java.math.BigDecimal min, java.math.BigDecimal max, java.math.BigDecimal size) {}
    public record Save(String name, Request configuration) {}
    public record Saved(long id, String name, Request configuration) {}
    public record Row(Object dimension, String value) {}
    public record Preview(List<Row> rows, boolean truncated, int limit, long durationMs) {}
    public record Plan(String sql, List<Object> parameters) {}
}
