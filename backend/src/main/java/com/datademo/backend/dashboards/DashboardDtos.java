package com.datademo.backend.dashboards;

public final class DashboardDtos {
    private DashboardDtos() {}
    public record Save(String name) {}
    public record View(long id, String name) {}
    public record AddChart(Long chartId) {}
    public record LayoutItem(Long chartId, Integer x, Integer y, Integer w, Integer h) {}
    public record LayoutSave(java.util.List<LayoutItem> items) {}
    public record CommonFilter(Long datasetId, String column, String value) {}
}
