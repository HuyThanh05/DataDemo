package com.datademo.backend.persistence;

import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.connections.repository.ConnectionRepository;
import com.datademo.backend.security.PasswordCipher;
import java.net.URI;
import java.net.http.*;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in live HTTP/MySQL regression; deletes only the row created by this test. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ConnectionFlowMySqlIT {
    @Autowired ConnectionRepository repository;
    @Autowired PasswordCipher cipher;
    @Autowired JdbcTemplate jdbc;
    @Value("${local.server.port}") int port;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final JsonMapper json = JsonMapper.builder().build();

    private HttpResponse<String> call(String path, Object body) throws Exception {
        return call(path, body, body == null ? "GET" : "POST");
    }

    private HttpResponse<String> call(String path, Object body, String method) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(Duration.ofSeconds(20));
        if (body == null) builder.GET();
        else builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void realConnectionLifecyclePreservesExistingRowsAndExamData() throws Exception {
        var original = jdbc.queryForList("SELECT * FROM database_connections ORDER BY id");
        var originalDatasets = jdbc.queryForList("SELECT * FROM datasets ORDER BY id");
        var originalColumns = jdbc.queryForList("SELECT * FROM dataset_columns ORDER BY id");
        var originalCharts = jdbc.queryForList("SELECT * FROM charts ORDER BY id");
        var originalDashboards = jdbc.queryForList("SELECT * FROM dashboards ORDER BY id");
        var originalDashboardCharts = jdbc.queryForList("SELECT * FROM dashboard_charts ORDER BY dashboard_id,chart_id");
        var originalLayouts = jdbc.queryForList("SELECT * FROM dashboard_chart_layouts ORDER BY dashboard_id,chart_id");
        var originalFilters = jdbc.queryForList("SELECT * FROM dashboard_filters ORDER BY dashboard_id");
        var view = repository.list().stream().filter(v -> v.databaseName().equals("datademo_source") && v.username().equals("datademo_reader"))
                .findFirst().orElseThrow(() -> new IllegalStateException("Save a reader connection through the UI before this integration check"));
        // Read the SOURCE credential from its own encrypted record, never reuse the app writer password.
        String password = cipher.decrypt(repository.find(view.id()).encryptedPassword());
        Input input = new Input("Regression-" + UUID.randomUUID(), view.host(), view.port(), view.databaseName(), view.username(), password);
        Properties props = new Properties();
        props.setProperty("user", view.username()); props.setProperty("password", password);
        props.setProperty("connectTimeout", "5000"); props.setProperty("socketTimeout", "10000");
        try (var source = DriverManager.getConnection("jdbc:mysql://" + view.host() + ":" + view.port() + "/" + view.databaseName(), props)) {
            source.setReadOnly(true);
            String before;
            try (var s = source.createStatement(); var r = s.executeQuery("SELECT COUNT(*),COUNT(DISTINCT candidate_id),SUM(score),MIN(score),MAX(score) FROM exam_scores")) {
                r.next(); before = r.getString(1) + ":" + r.getString(2) + ":" + r.getString(3) + ":" + r.getString(4) + ":" + r.getString(5);
                assertEquals(140567, r.getInt(1)); assertEquals(35526, r.getInt(2));
            }
            Long createdId = null;
            Long datasetId = null;
            Long chartId = null;
            Long dashboardId = null;
            try {
                assertEquals(200, call("/api/health", null).statusCode());
                assertEquals(200, call("/api/connections/test", input).statusCode());
                var created = call("/api/connections", input);
                assertEquals(201, created.statusCode());
                Map<?, ?> payload = json.readValue(created.body(), Map.class);
                createdId = ((Number) payload.get("id")).longValue();
                assertFalse(payload.containsKey("password"));
                assertNotEquals(password, repository.find(createdId).encryptedPassword());
                assertEquals(password, cipher.decrypt(repository.find(createdId).encryptedPassword()));
                var detail = call("/api/connections/" + createdId, null);
                assertEquals(200, detail.statusCode());
                assertFalse(json.readValue(detail.body(), Map.class).containsKey("encryptedPassword"));
                assertEquals(200, call("/api/connections/" + createdId + "/test", Map.of()).statusCode());
                var tables = call("/api/connections/" + createdId + "/tables", null);
                assertEquals(200, tables.statusCode());
                assertTrue(json.readValue(tables.body(), List.class).contains("exam_scores"));
                var columns = call("/api/connections/" + createdId + "/columns?table=exam_scores", null);
                assertEquals(200, columns.statusCode());
                assertEquals(8, json.readValue(columns.body(), List.class).size());
                var preview = call("/api/datasets/preview", Map.of("connectionId", createdId, "tableName", "exam_scores"));
                assertEquals(200, preview.statusCode());
                Map<?, ?> sample = json.readValue(preview.body(), Map.class);
                assertEquals(100, ((List<?>) sample.get("rows")).size());
                assertEquals(8, ((List<?>) sample.get("columns")).size());
                assertEquals(100, ((Number) sample.get("limit")).intValue());
                assertEquals(400, call("/api/datasets/preview", Map.of("connectionId", createdId, "tableName", "exam_scores`; DROP TABLE exam_scores; --")).statusCode());
                var createDataset = call("/api/datasets", Map.of("name", "Regression dataset", "connectionId", createdId, "tableName", "exam_scores", "columnLabels", Map.of("score", "Điểm thi", "subject_name", "Môn học")));
                assertEquals(201, createDataset.statusCode());
                Map<?, ?> savedDataset = json.readValue(createDataset.body(), Map.class);
                datasetId = ((Number) savedDataset.get("id")).longValue();
                assertEquals(8, ((List<?>) savedDataset.get("columns")).size());
                var chartConfiguration = Map.of("datasetId",datasetId,"chartType","line","dimension","score","aggregation","COUNT","metricColumn","score","sortDirection","ASC","filters",List.of(),"bucket",Map.of("min",0,"max",10,"size",1));
                var savedChartResponse = call("/api/charts",Map.of("name","Regression histogram","configuration",chartConfiguration));
                assertEquals(201,savedChartResponse.statusCode(),savedChartResponse.body());
                chartId = ((Number)json.readValue(savedChartResponse.body(),Map.class).get("id")).longValue();
                assertEquals(200,call("/api/charts/"+chartId,null).statusCode());
                assertEquals(200,call("/api/charts",null).statusCode());
                var histogramResponse = call("/api/charts/"+chartId+"/preview",null);
                assertEquals(200,histogramResponse.statusCode(),histogramResponse.body());
                var histogram = (List<?>)json.readValue(histogramResponse.body(),Map.class).get("rows");
                try(var s=source.createStatement();var r=s.executeQuery("SELECT CASE WHEN score=10 THEN 9 ELSE FLOOR(score) END,COUNT(score) FROM exam_scores WHERE score>=0 AND score<=10 GROUP BY 1 ORDER BY 1")) {
                    int index=0;
                    while(r.next()) {
                        var row=(Map<?,?>)histogram.get(index++);
                        assertEquals(0,r.getBigDecimal(1).compareTo(new java.math.BigDecimal(row.get("dimension").toString())));
                        assertEquals(r.getString(2),row.get("value"));
                    }
                    assertEquals(index,histogram.size());
                }
                assertEquals(200,call("/api/charts/"+chartId,Map.of("name","Updated histogram","configuration",chartConfiguration),"PATCH").statusCode());
                assertTrue(call("/api/charts/"+chartId,null).body().contains("Updated histogram"));
                var dashboardResponse = call("/api/dashboards",Map.of("name","Regression chart dashboard"));
                assertEquals(201,dashboardResponse.statusCode());
                dashboardId = ((Number)json.readValue(dashboardResponse.body(),Map.class).get("id")).longValue();
                String dashboardChartsPath = "/api/dashboards/"+dashboardId+"/charts";
                for(int i=0;i<2;i++) assertEquals(200,call(dashboardChartsPath,Map.of("chartId",chartId)).statusCode());
                var dashboardChartsResponse = call(dashboardChartsPath,null);
                assertEquals(200,dashboardChartsResponse.statusCode());
                assertEquals(1,json.readValue(dashboardChartsResponse.body(),List.class).size());
                var layoutBody=Map.of("items",List.of(Map.of("chartId",chartId,"x",2,"y",3,"w",8,"h",14)));
                var savedLayout=call("/api/dashboards/"+dashboardId+"/layout",layoutBody,"PUT");
                assertEquals(200,savedLayout.statusCode(),savedLayout.body());
                assertEquals(savedLayout.body(),call("/api/dashboards/"+dashboardId+"/layout",null).body());
                assertEquals(8,((Number)((Map<?,?>)json.readValue(savedLayout.body(),List.class).getFirst()).get("w")).intValue());
                var privateConfiguration=new HashMap<String,Object>(chartConfiguration);
                privateConfiguration.put("filters",List.of(Map.of("column","score","operator","GTE","value","5")));
                assertEquals(200,call("/api/charts/"+chartId,Map.of("name","Updated histogram","configuration",privateConfiguration),"PATCH").statusCode());
                String originalChartConfig=call("/api/charts/"+chartId,null).body();
                String filterPath="/api/dashboards/"+dashboardId+"/filter";
                var valuesResponse=call("/api/dashboards/"+dashboardId+"/filter-values?datasetId="+datasetId+"&column=subject_name",null);
                assertEquals(200,valuesResponse.statusCode(),valuesResponse.body());
                var subjectValues=(List<?>)json.readValue(valuesResponse.body(),Map.class).get("values");
                assertFalse(subjectValues.isEmpty());String chosenSubject=subjectValues.getFirst().toString();
                for(String subject:new String[]{chosenSubject,null}) {
                    var common=new com.datademo.backend.dashboards.DashboardDtos.CommonFilter(datasetId,"subject_name",subject);
                    assertEquals(200,call(filterPath,common,"PUT").statusCode());
                    assertEquals(subject,json.readValue(call(filterPath,null).body(),Map.class).get("value"));
                    var result=call(dashboardChartsPath+"/"+chartId+"/preview",null);
                    assertEquals(200,result.statusCode(),result.body());
                    var actualRows=(List<?>)json.readValue(result.body(),Map.class).get("rows");
                    String sql="SELECT CASE WHEN score=10 THEN 9 ELSE FLOOR(score) END,COUNT(score) FROM exam_scores WHERE score>=0 AND score<=10 AND score>=5"+(subject==null?"":" AND subject_name=?")+" GROUP BY 1 ORDER BY 1";
                    try(var p=source.prepareStatement(sql)) {
                        if(subject!=null) p.setString(1,subject);
                        try(var r=p.executeQuery()) { int index=0;while(r.next()) {
                            var row=(Map<?,?>)actualRows.get(index++);
                            assertEquals(0,r.getBigDecimal(1).compareTo(new java.math.BigDecimal(row.get("dimension").toString())));assertEquals(r.getString(2),row.get("value"));
                        } assertEquals(index,actualRows.size()); }
                    }
                }
                assertEquals(originalChartConfig,call("/api/charts/"+chartId,null).body());
                assertEquals(savedLayout.body(),call("/api/dashboards/"+dashboardId+"/layout",null).body());
                assertEquals(404,call(dashboardChartsPath+"/999999999/preview",null).statusCode());
                assertEquals(400,call(filterPath,new com.datademo.backend.dashboards.DashboardDtos.CommonFilter(datasetId,"not_a_column","Toán"),"PUT").statusCode());
                assertEquals(200,call(filterPath,new com.datademo.backend.dashboards.DashboardDtos.CommonFilter(null,null,null),"PUT").statusCode());
                var deleteRequest = HttpRequest.newBuilder(URI.create("http://localhost:"+port+dashboardChartsPath+"/"+chartId)).timeout(Duration.ofSeconds(20)).DELETE().build();
                assertEquals(200,http.send(deleteRequest,HttpResponse.BodyHandlers.ofString()).statusCode());
                assertEquals(0,json.readValue(call(dashboardChartsPath,null).body(),List.class).size());
                assertEquals(200,call("/api/charts/"+chartId,null).statusCode());
                assertEquals(200,call(dashboardChartsPath,Map.of("chartId",chartId)).statusCode());
                for (String aggregate : List.of("AVG", "COUNT")) {
                    var chart = call("/api/charts/preview", Map.of("datasetId", datasetId, "chartType", "bar", "dimension", "subject_name", "aggregation", aggregate, "metricColumn", "score", "sortDirection", "DESC", "filters", List.of(Map.of("column", "score", "operator", "GTE", "value", "0"))));
                    assertEquals(200, chart.statusCode(), chart.body());
                    var chartPayload = json.readValue(chart.body(), Map.class);
                    var actual = (List<?>) chartPayload.get("rows");
                    assertEquals(false, chartPayload.get("truncated"));
                    try (var s = source.createStatement(); var r = s.executeQuery("SELECT subject_name," + aggregate + "(score) FROM exam_scores WHERE score>=0 GROUP BY subject_name ORDER BY subject_name DESC")) {
                        int index = 0;
                        while (r.next()) {
                            var row = (Map<?, ?>) actual.get(index++);
                            assertEquals(r.getString(1), row.get("dimension"));
                            assertEquals(0, r.getBigDecimal(2).compareTo(new java.math.BigDecimal((String) row.get("value"))));
                        }
                        assertEquals(index, actual.size());
                    }
                }
                assertEquals(400, call("/api/charts/preview", Map.of("datasetId", datasetId, "chartType", "bar", "dimension", "score`; DROP TABLE exam_scores", "aggregation", "COUNT", "metricColumn", "score", "sortDirection", "ASC")).statusCode());
                var reopened = call("/api/datasets/" + datasetId, null);
                assertEquals(200, reopened.statusCode());
                assertTrue(reopened.body().contains("Điểm thi"));
                assertEquals(200, call("/api/datasets", null).statusCode());
                var savedPreview = call("/api/datasets/" + datasetId + "/preview", null);
                assertEquals(200, savedPreview.statusCode());
                assertEquals(100, ((List<?>) json.readValue(savedPreview.body(), Map.class).get("rows")).size());
                var patched = call("/api/datasets/" + datasetId, Map.of("name", "Renamed regression dataset", "columnLabels", Map.of("score", "Điểm")), "PATCH");
                assertEquals(200, patched.statusCode());
                assertTrue(call("/api/datasets/" + datasetId, null).body().contains("Renamed regression dataset"));
                assertEquals(400, call("/api/datasets", Map.of("name", "Bad labels", "connectionId", createdId, "tableName", "exam_scores", "columnLabels", Map.of("not_a_column", "Invalid"))).statusCode());
                assertEquals(400, call("/api/connections/" + createdId + "/columns?table=not_an_allowed_table", null).statusCode());
                var denied = new Input(input.name(), input.host(), input.port(), input.databaseName(), input.username(), "intentionally-wrong-regression-password");
                assertEquals(502, call("/api/connections/test", denied).statusCode());
            } finally {
                if(dashboardId != null) {
                    jdbc.update("DELETE FROM dashboard_charts WHERE dashboard_id=?",dashboardId);
                    jdbc.update("DELETE FROM dashboards WHERE id=?",dashboardId);
                }
                if (chartId != null) jdbc.update("DELETE FROM charts WHERE id=?",chartId);
                if (datasetId != null) {
                    jdbc.update("DELETE FROM dataset_columns WHERE dataset_id=?", datasetId);
                    jdbc.update("DELETE FROM datasets WHERE id=?", datasetId);
                }
                if (createdId != null) jdbc.update("DELETE FROM database_connections WHERE id=? AND name=?", createdId, input.name());
            }
            assertEquals(original, jdbc.queryForList("SELECT * FROM database_connections ORDER BY id"));
            assertEquals(originalDatasets, jdbc.queryForList("SELECT * FROM datasets ORDER BY id"));
            assertEquals(originalColumns, jdbc.queryForList("SELECT * FROM dataset_columns ORDER BY id"));
            assertEquals(originalCharts, jdbc.queryForList("SELECT * FROM charts ORDER BY id"));
            assertEquals(originalDashboards,jdbc.queryForList("SELECT * FROM dashboards ORDER BY id"));
            assertEquals(originalDashboardCharts,jdbc.queryForList("SELECT * FROM dashboard_charts ORDER BY dashboard_id,chart_id"));
            assertEquals(originalLayouts,jdbc.queryForList("SELECT * FROM dashboard_chart_layouts ORDER BY dashboard_id,chart_id"));
            assertEquals(originalFilters,jdbc.queryForList("SELECT * FROM dashboard_filters ORDER BY dashboard_id"));
            try (var s = source.createStatement(); var r = s.executeQuery("SELECT COUNT(*),COUNT(DISTINCT candidate_id),SUM(score),MIN(score),MAX(score) FROM exam_scores")) {
                r.next(); assertEquals(before, r.getString(1) + ":" + r.getString(2) + ":" + r.getString(3) + ":" + r.getString(4) + ":" + r.getString(5));
            }
        }
    }
}
