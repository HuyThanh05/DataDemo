package com.datademo.backend.dashboards;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:dashboard-api;MODE=MySQL;DB_CLOSE_DELAY=-1", "spring.datasource.username=sa", "spring.datasource.password=", "spring.config.import=optional:classpath:absent-test.properties"})
class DashboardApiTests {
    @Autowired DashboardService service;
    @Autowired DashboardRepository repository;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.datademo.backend.charts.ChartRepository charts;
    private final JsonMapper json = JsonMapper.builder().build();
    @Test void savesLayoutAtomicallyAndRejectsStaleOrOverlappingItems() throws Exception {
        jdbc.update("INSERT INTO database_connections(id,name,host,port,database_name,username,encrypted_password) VALUES(502,'Demo','localhost',3306,'source','reader','cipher')");
        jdbc.update("INSERT INTO datasets(id,name,connection_id,table_name) VALUES(502,'Dataset',502,'scores')");
        var config = new com.datademo.backend.charts.ChartDtos.Request(502L,"bar","score","COUNT","score","ASC",java.util.List.of());
        var a=charts.save(null,"Layout chart A",config);var b=charts.save(null,"Layout chart B",config);
        var dashboard=service.save(null,new DashboardDtos.Save("Layout dashboard"));
        var other=service.save(null,new DashboardDtos.Save("Independent layout"));
        service.addChart(dashboard.id(),new DashboardDtos.AddChart(a.id()));service.addChart(dashboard.id(),new DashboardDtos.AddChart(b.id()));
        service.addChart(other.id(),new DashboardDtos.AddChart(a.id()));
        var common=new DashboardDtos.CommonFilter(502L,"score","5");
        repository.saveFilter(dashboard.id(),common);
        assertEquals(common,new DashboardRepository(jdbc).filter(dashboard.id()));
        assertNull(repository.filter(other.id()).datasetId());
        repository.saveFilter(dashboard.id(),new DashboardDtos.CommonFilter(502L,"score",null));
        assertNull(repository.filter(dashboard.id()).value());
        repository.saveFilter(dashboard.id(),new DashboardDtos.CommonFilter(null,null,null));
        assertNull(repository.filter(dashboard.id()).datasetId());
        var desired=java.util.List.of(new DashboardDtos.LayoutItem(a.id(),2,3,8,14),new DashboardDtos.LayoutItem(b.id(),0,17,6,10));
        var mvc=MockMvcBuilders.standaloneSetup(new DashboardController(service)).build();
        String path="/api/dashboards/"+dashboard.id()+"/layout";
        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new DashboardDtos.LayoutSave(desired)))).andExpect(status().isOk());
        assertEquals(desired,new DashboardRepository(jdbc).layout(dashboard.id()));
        mvc.perform(get(path)).andExpect(status().isOk());
        assertEquals(0,service.layout(other.id()).getFirst().x());
        var overlap=java.util.List.of(desired.getFirst(),new DashboardDtos.LayoutItem(b.id(),2,3,6,10));
        var duplicate=java.util.List.of(desired.getFirst(),desired.getFirst());
        var outside=java.util.List.of(new DashboardDtos.LayoutItem(a.id(),11,3,8,14),desired.getLast());
        for(var invalid:java.util.List.of(overlap,duplicate,outside)) mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new DashboardDtos.LayoutSave(invalid)))).andExpect(status().isBadRequest());
        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new DashboardDtos.LayoutSave(java.util.List.of(desired.getFirst()))))).andExpect(status().isConflict());
        assertEquals(desired,repository.layout(dashboard.id()));
        service.removeChart(dashboard.id(),a.id());
        assertEquals(java.util.List.of(desired.getLast()),repository.layout(dashboard.id()));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM dashboard_chart_layouts WHERE dashboard_id=? AND chart_id=?",Integer.class,dashboard.id(),a.id()));
        service.addChart(dashboard.id(),new DashboardDtos.AddChart(a.id()));
        assertEquals(desired.getLast(),repository.layout(dashboard.id()).stream().filter(item->item.chartId()==b.id()).findFirst().orElseThrow());
        assertEquals(a,charts.get(a.id()));
    }
    @Test void linksSavedChartsIdempotentlyAndRemovalDoesNotDeleteOriginal() throws Exception {
        jdbc.update("INSERT INTO database_connections(id,name,host,port,database_name,username,encrypted_password) VALUES(501,'Demo','localhost',3306,'source','reader','cipher')");
        jdbc.update("INSERT INTO datasets(id,name,connection_id,table_name) VALUES(501,'Dataset',501,'scores')");
        var config = new com.datademo.backend.charts.ChartDtos.Request(501L,"bar","score","COUNT","score","ASC",java.util.List.of());
        var chart = charts.save(null,"Saved chart",config);
        var dashboard = service.save(null,new DashboardDtos.Save("Chart dashboard"));
        var another = service.save(null,new DashboardDtos.Save("Another dashboard"));
        var mvc = MockMvcBuilders.standaloneSetup(new DashboardController(service)).build();
        String path = "/api/dashboards/"+dashboard.id()+"/charts";
        String body = json.writeValueAsString(Map.of("chartId",chart.id()));
        for(int i=0;i<2;i++) mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        assertEquals(java.util.List.of(chart.id()),new DashboardRepository(jdbc).chartIds(dashboard.id()));
        assertTrue(repository.chartIds(another.id()).isEmpty());
        service.addChart(another.id(),new DashboardDtos.AddChart(chart.id()));
        mvc.perform(get(path)).andExpect(status().isOk());
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{\"chartId\":999999}")).andExpect(status().isNotFound());
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/dashboards/999999/charts").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
        for(int i=0;i<2;i++) mvc.perform(delete(path+"/"+chart.id())).andExpect(status().isOk());
        assertTrue(repository.chartIds(dashboard.id()).isEmpty());
        assertEquals(chart,charts.get(chart.id()));
        assertEquals(java.util.List.of(chart.id()),repository.chartIds(another.id()));
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        assertEquals(java.util.List.of(chart),service.charts(dashboard.id()));
    }
    @Test void createsReopensAndRenamesOneDashboard() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new DashboardController(service)).build();
        var response = mvc.perform(post("/api/dashboards").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"  Phân tích điểm thi  \"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        long id = ((Number)json.readValue(response,Map.class).get("id")).longValue();
        assertEquals("Phân tích điểm thi",repository.get(id).name());
        mvc.perform(get("/api/dashboards/"+id)).andExpect(status().isOk());
        mvc.perform(patch("/api/dashboards/"+id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Dashboard mới\"}")).andExpect(status().isOk());
        assertEquals("Dashboard mới",repository.get(id).name());
        mvc.perform(get("/api/dashboards")).andExpect(status().isOk());
    }
    @Test void rejectsInvalidNamesAndMissingDashboard() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new DashboardController(service)).build();
        int before = repository.list().size();
        for (String name : new String[]{"", "   ", "x".repeat(101)}) {
            mvc.perform(post("/api/dashboards").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("name",name)))).andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/dashboards").contentType(MediaType.APPLICATION_JSON).content("{}" )).andExpect(status().isBadRequest());
        mvc.perform(get("/api/dashboards/999999")).andExpect(status().isNotFound());
        mvc.perform(patch("/api/dashboards/999999").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Missing\"}")).andExpect(status().isNotFound());
        assertEquals(before,repository.list().size());
    }
}
