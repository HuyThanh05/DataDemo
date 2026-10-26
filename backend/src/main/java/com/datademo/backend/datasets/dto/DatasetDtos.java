package com.datademo.backend.datasets.dto;

import java.util.List;
import java.util.Map;

public final class DatasetDtos {
    private DatasetDtos() {}
    public record Create(String name, Long connectionId, String tableName, Map<String, String> columnLabels) {}
    public record Patch(String name, Map<String, String> columnLabels) {}
    public record Summary(long id, String name, long connectionId, String tableName) {}
    public record Column(long id, String name, String displayName, String dataType, boolean nullable,
                         boolean canGroup, boolean canAggregate, boolean canFilter) {}
    public record Detail(long id, String name, long connectionId, String tableName, List<Column> columns) {}
}
