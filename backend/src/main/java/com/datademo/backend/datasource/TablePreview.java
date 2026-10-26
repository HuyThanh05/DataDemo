package com.datademo.backend.datasource;

import java.util.List;

public record TablePreview(List<PreviewColumn> columns, List<List<Object>> rows, int limit) {
    public record PreviewColumn(String name, String dataType) {}
}
