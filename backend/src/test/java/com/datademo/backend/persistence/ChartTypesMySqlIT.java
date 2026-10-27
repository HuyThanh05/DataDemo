package com.datademo.backend.persistence;

import com.datademo.backend.charts.*;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.dto.DatasetDtos.Create;
import com.datademo.backend.datasets.service.DatasetService;
import com.datademo.backend.dashboards.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in against the existing local reader connection; only its own configuration is removed. */
@SpringBootTest
class ChartTypesMySqlIT {
    @Autowired ConnectionService connections;
    @Autowired DatasetService datasets;
    @Autowired ChartService charts;
    @Autowired DashboardService dashboards;
    @Autowired DashboardFilterService filters;
    @Autowired JdbcTemplate jdbc;

    @Test void previewsSavesReopensAndFiltersPieAndTableUsingRealMySql() {
        assertEquals("datademo_app", jdbc.queryForObject("SELECT DATABASE()", String.class));
        var source = connections.list().stream().filter(c -> c.databaseName().equals("datademo_source")).findFirst().orElseThrow();
        var beforeCharts = jdbc.queryForList("SELECT * FROM charts ORDER BY id");
        var beforeDatasets = jdbc.queryForList("SELECT * FROM datasets ORDER BY id");
        var beforeDashboards = jdbc.queryForList("SELECT * FROM dashboards ORDER BY id");
        var expected = connections.aggregate(source.id(), "exam_scores", new ChartDtos.Plan("SELECT subject_name,COUNT(score) FROM exam_scores GROUP BY subject_name ORDER BY subject_name ASC LIMIT 1001", List.of())).rows();
        String prefix = "ChartTypesIT-" + UUID.randomUUID();
        Long datasetId = null, dashboardId = null;
        var chartIds = new ArrayList<Long>();
        try {
            datasetId = datasets.create(new Create(prefix, source.id(), "exam_scores", Map.of("subject_name", "Môn học", "score", "Điểm thi"))).id();
            dashboardId = dashboards.save(null, new DashboardDtos.Save(prefix)).id();
            for (String type : List.of("pie", "table")) {
                var configuration = new ChartDtos.Request(datasetId, type, "subject_name", "COUNT", "score", "ASC", List.of());
                var saved = charts.save(null, new ChartDtos.Save(prefix + type, configuration));
                chartIds.add(saved.id());
                assertEquals(configuration, charts.get(saved.id()).configuration());
                assertEquals(expected, charts.preview(configuration).rows());
                dashboards.addChart(dashboardId, new DashboardDtos.AddChart(saved.id()));
            }
            filters.save(dashboardId, new DashboardDtos.CommonFilter(datasetId, "subject_name", "Toán"));
            var expectedMath = expected.stream().filter(row -> row.dimension().equals("Toán")).toList();
            for (long chartId : chartIds) assertEquals(expectedMath, filters.preview(dashboardId, chartId).rows());
        } finally {
            if (dashboardId != null) dashboards.delete(dashboardId);
            for (long chartId : chartIds) charts.delete(chartId);
            if (datasetId != null) datasets.delete(datasetId);
        }
        assertEquals(beforeCharts, jdbc.queryForList("SELECT * FROM charts ORDER BY id"));
        assertEquals(beforeDatasets, jdbc.queryForList("SELECT * FROM datasets ORDER BY id"));
        assertEquals(beforeDashboards, jdbc.queryForList("SELECT * FROM dashboards ORDER BY id"));
        assertEquals(expected, connections.aggregate(source.id(), "exam_scores", new ChartDtos.Plan("SELECT subject_name,COUNT(score) FROM exam_scores GROUP BY subject_name ORDER BY subject_name ASC LIMIT 1001", List.of())).rows());
    }
}
