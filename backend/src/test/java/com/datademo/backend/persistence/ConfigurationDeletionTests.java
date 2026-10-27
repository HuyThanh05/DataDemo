package com.datademo.backend.persistence;

import com.datademo.backend.charts.*;
import com.datademo.backend.connections.controller.ConnectionController;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.controller.DatasetController;
import com.datademo.backend.datasets.service.DatasetService;
import com.datademo.backend.dashboards.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:configuration-delete;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.config.import=optional:classpath:absent-test.properties"
})
class ConfigurationDeletionTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired ConnectionService connections;
    @Autowired DatasetService datasets;
    @Autowired ChartService charts;
    @Autowired DashboardService dashboards;
    @Autowired DashboardRepository dashboardRepository;
    @Autowired ChartRepository chartRepository;
    private MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new ConnectionController(connections), new DatasetController(datasets),
                new ChartController(charts), new DashboardController(dashboards)).build();
    }

    @Test void blocksDependenciesAndDeletesOnlyRequestedConfiguration() throws Exception {
        var f = fixture();
        var other = dashboards.save(null, new DashboardDtos.Save("Other dashboard"));
        dashboards.addChart(other.id(), new DashboardDtos.AddChart(f.chart()));
        var layout = List.of(new DashboardDtos.LayoutItem(f.chart(), 0, 0, 6, 12));
        dashboardRepository.saveLayout(f.dashboard(), layout);
        dashboardRepository.saveLayout(other.id(), layout);
        var filter = new DashboardDtos.CommonFilter(f.dataset(), "score", "5");
        dashboardRepository.saveFilter(f.dashboard(), filter);
        dashboardRepository.saveFilter(other.id(), filter);
        var originalChart = charts.get(f.chart());
        var originalDataset = datasets.get(f.dataset());

        conflict("connections", f.connection(), "CONNECTION_IN_USE");
        conflict("datasets", f.dataset(), "DATASET_IN_USE");
        conflict("charts", f.chart(), "CHART_IN_USE");
        mvc.perform(delete("/api/dashboards/" + f.dashboard())).andExpect(status().isNoContent()).andExpect(content().string(""));
        for (String table : List.of("dashboard_charts", "dashboard_chart_layouts", "dashboard_filters"))
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE dashboard_id=?", Integer.class, f.dashboard()));
        assertEquals(originalChart, charts.get(f.chart()));
        assertEquals(originalDataset, datasets.get(f.dataset()));
        assertEquals(layout, dashboardRepository.layout(other.id()));
        assertEquals(filter, dashboardRepository.filter(other.id()));
        conflict("charts", f.chart(), "CHART_IN_USE");
        mvc.perform(delete("/api/dashboards/" + other.id())).andExpect(status().isNoContent());
        mvc.perform(delete("/api/charts/" + f.chart())).andExpect(status().isNoContent());
        assertEquals(originalDataset, datasets.get(f.dataset()));
        mvc.perform(delete("/api/datasets/" + f.dataset())).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM dataset_columns WHERE dataset_id=?", Integer.class, f.dataset()));
        assertEquals(f.connection(), connections.get(f.connection()).id());
        mvc.perform(delete("/api/connections/" + f.connection())).andExpect(status().isNoContent());
        for (var item : List.of("connections/" + f.connection(), "datasets/" + f.dataset(), "charts/" + f.chart(), "dashboards/" + f.dashboard())) {
            mvc.perform(get("/api/" + item)).andExpect(status().isNotFound());
            mvc.perform(delete("/api/" + item)).andExpect(status().isNotFound());
        }
    }

    @Test void keepsDatasetReferencedByDashboardFilterUntilFilterIsCleared() throws Exception {
        var f = fixture();
        dashboardRepository.saveFilter(f.dashboard(), new DashboardDtos.CommonFilter(f.dataset(), "score", "5"));
        dashboards.removeChart(f.dashboard(), f.chart());
        mvc.perform(delete("/api/charts/" + f.chart())).andExpect(status().isNoContent());
        conflict("datasets", f.dataset(), "DATASET_IN_USE");
        assertFalse(datasets.get(f.dataset()).columns().isEmpty());
        dashboardRepository.saveFilter(f.dashboard(), new DashboardDtos.CommonFilter(null, null, null));
        mvc.perform(delete("/api/datasets/" + f.dataset())).andExpect(status().isNoContent());
        assertEquals(f.dashboard(), dashboards.get(f.dashboard()).id());
        mvc.perform(delete("/api/connections/" + f.connection())).andExpect(status().isNoContent());
    }

    @Test void rollsBackColumnDeletionIfAnAdditionalReferencePreventsDatasetDeletion() throws Exception {
        var f = fixture();
        dashboards.removeChart(f.dashboard(), f.chart());
        charts.delete(f.chart());
        jdbc.execute("CREATE TABLE extra_dataset_reference(dataset_id BIGINT REFERENCES datasets(id))");
        try {
            jdbc.update("INSERT INTO extra_dataset_reference(dataset_id) VALUES(?)", f.dataset());
            var before = datasets.get(f.dataset());
            conflict("datasets", f.dataset(), "DATASET_IN_USE");
            assertEquals(before, datasets.get(f.dataset()), "Dataset and labels must roll back together");
        } finally { jdbc.execute("DROP TABLE extra_dataset_reference"); }
    }

    private void conflict(String resource, long id, String code) throws Exception {
        mvc.perform(delete("/api/" + resource + "/" + id)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(code));
    }

    private record Fixture(long connection, long dataset, long chart, long dashboard) {}
    private Fixture fixture() {
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(c -> c.prepareStatement("INSERT INTO database_connections(name,host,port,database_name,username,encrypted_password) VALUES('Deletion fixture','localhost',3306,'untouched_source','reader','test-only')", new String[]{"id"}), keys);
        long connection = keys.getKey().longValue();
        jdbc.update("INSERT INTO datasets(name,connection_id,table_name) VALUES('Deletion dataset',?,'exam_scores')", connection);
        long dataset = jdbc.queryForObject("SELECT id FROM datasets WHERE connection_id=?", Long.class, connection);
        jdbc.update("INSERT INTO dataset_columns(dataset_id,column_name,display_name,data_type,is_nullable,ordinal_position,can_group,can_aggregate,can_filter) VALUES(?,'score','Điểm thi','decimal',false,0,true,true,true)", dataset);
        var configuration = new ChartDtos.Request(dataset, "bar", "score", "COUNT", "score", "ASC", List.of());
        var chart = chartRepository.save(null, "Deletion chart", configuration);
        var dashboard = dashboards.save(null, new DashboardDtos.Save("Deletion dashboard"));
        dashboards.addChart(dashboard.id(), new DashboardDtos.AddChart(chart.id()));
        return new Fixture(connection, dataset, chart.id(), dashboard.id());
    }
}
