package com.datademo.backend.persistence;

import com.datademo.backend.charts.*;
import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.connections.repository.ConnectionRepository;
import com.datademo.backend.datasets.dto.DatasetDtos.Column;
import com.datademo.backend.datasets.repository.DatasetRepository;
import com.datademo.backend.dashboards.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in: creates and deletes only its own configuration; never opens a source connection. */
@SpringBootTest
class ConfigurationDeletionMySqlIT {
    @Autowired JdbcTemplate jdbc;
    @Autowired ConnectionRepository connections;
    @Autowired DatasetRepository datasets;
    @Autowired ChartRepository charts;
    @Autowired DashboardRepository dashboards;
    private static final List<String> TABLES = List.of("database_connections", "datasets", "dataset_columns", "charts", "dashboards", "dashboard_charts", "dashboard_chart_layouts", "dashboard_filters");

    @Test void deletesOwnConfigurationOnMySqlAndPreservesAllPreviousRows() throws Exception {
        assertEquals("datademo_app", jdbc.queryForObject("SELECT DATABASE()", String.class));
        var before = snapshot();
        Long connectionId = null, datasetId = null, chartId = null, dashboardId = null;
        String name = "DeleteIT-" + UUID.randomUUID();
        try {
            // Repository fixtures do not need or decrypt any real source credential.
            connectionId = connections.save(new Input(name, "localhost", 3306, "untouched_source", "fixture_reader", "unused"), "fixture-not-a-real-password").id();
            var dataset = datasets.create(name, connectionId, "untouched_table", List.of(new Column(0, "score", "Điểm", "decimal", false, true, true, true)));
            datasetId = dataset.id();
            var chart = charts.save(null, name, new ChartDtos.Request(datasetId, "bar", "score", "COUNT", "score", "ASC", List.of()));
            chartId = chart.id();
            dashboardId = dashboards.save(null, name).id();
            dashboards.addChart(dashboardId, chartId);
            dashboards.saveLayout(dashboardId, List.of(new DashboardDtos.LayoutItem(chartId, 0, 0, 6, 12)));
            dashboards.saveFilter(dashboardId, new DashboardDtos.CommonFilter(datasetId, "score", "5"));
            long c = connectionId, d = datasetId, ch = chartId;
            assertEquals(HttpStatus.CONFLICT, assertThrows(ApiFailure.class, () -> connections.delete(c)).status);
            assertEquals(HttpStatus.CONFLICT, assertThrows(ApiFailure.class, () -> datasets.delete(d)).status);
            assertEquals(HttpStatus.CONFLICT, assertThrows(ApiFailure.class, () -> charts.delete(ch)).status);

            dashboards.delete(dashboardId);
            assertEquals(chart, charts.get(chartId));
            assertEquals(dataset, datasets.get(datasetId));
            for (String table : List.of("dashboard_charts", "dashboard_chart_layouts", "dashboard_filters"))
                assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE dashboard_id=?", Integer.class, dashboardId));
            charts.delete(chartId);
            datasets.delete(datasetId);
            connections.delete(connectionId);
            assertEquals(before, snapshot(), "Existing configuration must remain byte-for-byte equivalent");
        } finally {
            // Exact captured IDs only; cleanup also runs after an assertion failure.
            if (dashboardId != null && jdbc.queryForObject("SELECT COUNT(*) FROM dashboards WHERE id=?", Integer.class, dashboardId) > 0) dashboards.delete(dashboardId);
            if (chartId != null && jdbc.queryForObject("SELECT COUNT(*) FROM charts WHERE id=?", Integer.class, chartId) > 0) charts.delete(chartId);
            if (datasetId != null && jdbc.queryForObject("SELECT COUNT(*) FROM datasets WHERE id=?", Integer.class, datasetId) > 0) datasets.delete(datasetId);
            if (connectionId != null && jdbc.queryForObject("SELECT COUNT(*) FROM database_connections WHERE id=?", Integer.class, connectionId) > 0) connections.delete(connectionId);
        }
        assertEquals(before, snapshot());
    }

    private Map<String, String> snapshot() throws Exception {
        var result = new LinkedHashMap<String, String>();
        for (String table : TABLES) {
            var digest = MessageDigest.getInstance("SHA-256");
            String order = switch (table) {
                case "dashboard_charts", "dashboard_chart_layouts" -> "dashboard_id,chart_id";
                case "dashboard_filters" -> "dashboard_id";
                default -> "id";
            };
            jdbc.query("SELECT * FROM " + table + " ORDER BY " + order, row -> {
                for (int i = 1; i <= row.getMetaData().getColumnCount(); i++) {
                    byte[] value = String.valueOf(row.getObject(i)).getBytes(StandardCharsets.UTF_8);
                    digest.update(java.nio.ByteBuffer.allocate(4).putInt(value.length).array());
                    digest.update(value);
                }
            });
            result.put(table, HexFormat.of().formatHex(digest.digest()));
        }
        return result;
    }
}
