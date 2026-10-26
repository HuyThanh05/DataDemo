package com.datademo.backend.persistence;

import com.datademo.backend.dashboards.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in integration against local datademo_app; removes only its own row. */
@SpringBootTest
class DashboardMySqlIT {
    @Autowired DashboardService service;
    @Autowired JdbcTemplate jdbc;
    @Test void savesRenamesAndReopensWithoutChangingExistingConfiguration() {
        assertEquals("datademo_app",jdbc.queryForObject("SELECT DATABASE()",String.class));
        var original = jdbc.queryForList("SELECT * FROM dashboards ORDER BY id");
        var charts = jdbc.queryForList("SELECT * FROM charts ORDER BY id");
        Long createdId = null;
        try {
            var created = service.save(null,new DashboardDtos.Save("Regression-"+UUID.randomUUID()));
            createdId = created.id();
            assertEquals(created,new DashboardRepository(jdbc).get(created.id()));
            var updated = service.save(created.id(),new DashboardDtos.Save("Renamed regression dashboard"));
            assertEquals(created.id(),updated.id());
            assertEquals(updated,new DashboardRepository(jdbc).get(created.id()));
            assertTrue(service.list().contains(updated));
        } finally {
            if(createdId != null) jdbc.update("DELETE FROM dashboards WHERE id=?",createdId);
        }
        assertEquals(original,jdbc.queryForList("SELECT * FROM dashboards ORDER BY id"));
        assertEquals(charts,jdbc.queryForList("SELECT * FROM charts ORDER BY id"));
    }
}
