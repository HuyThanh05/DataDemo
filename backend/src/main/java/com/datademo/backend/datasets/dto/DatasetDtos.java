package com.datademo.backend.datasets.dto;

import java.util.List;
import java.util.Map;

public final class DatasetDtos {
    private DatasetDtos() {}
    public record Create(String name, Long connectionId, String tableName, Map<String, String> columnLabels, Map<String, ColumnSettings> columnSettings) {
        public Create(String name, Long connectionId, String tableName, Map<String,String> labels) { this(name,connectionId,tableName,labels,null); }
    }
    public record Patch(String name, Map<String, String> columnLabels, Map<String,ColumnSettings> columnSettings) {
        public Patch(String name, Map<String,String> labels) { this(name,labels,null); }
    }
    public record ColumnSettings(String role, List<String> allowedAggregations, String defaultAggregation) {}
    public record Summary(long id, String name, long connectionId, String tableName) {}
    public record Column(long id, String name, String displayName, String dataType, boolean nullable,
                         boolean canGroup, boolean canAggregate, boolean canFilter,
                         String role, List<String> allowedAggregations, String defaultAggregation) {
        public Column(long id,String name,String displayName,String dataType,boolean nullable,boolean canGroup,boolean canAggregate,boolean canFilter) {
            this(id,name,displayName,dataType,nullable,canGroup,canAggregate,canFilter,
                canAggregate?"MEASURE":"DIMENSION",canAggregate?List.of("COUNT","SUM","AVG","MIN","MAX"):List.of("COUNT"),canAggregate?"AVG":"COUNT");
        }
    }
    public record Detail(long id, String name, long connectionId, String tableName, List<Column> columns) {}
}
