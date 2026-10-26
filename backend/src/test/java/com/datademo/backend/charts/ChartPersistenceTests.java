package com.datademo.backend.charts;

import com.datademo.backend.common.ApiFailure;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static com.datademo.backend.charts.ChartDtos.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:charts;MODE=MySQL;DB_CLOSE_DELAY=-1", "spring.datasource.username=sa", "spring.datasource.password=", "spring.config.import=optional:classpath:absent-test.properties"})
class ChartPersistenceTests {
    @Autowired ChartRepository repository;
    @Autowired JdbcTemplate jdbc;
    @Test void savesAndUpdatesAllConfigurationAcrossRepositoryInstances() {
        jdbc.update("DELETE FROM charts");jdbc.update("DELETE FROM datasets");jdbc.update("DELETE FROM database_connections");
        jdbc.update("INSERT INTO database_connections(id,name,host,port,database_name,username,encrypted_password) VALUES(1,'Demo','localhost',3306,'source','reader','cipher')");
        jdbc.update("INSERT INTO datasets(id,name,connection_id,table_name) VALUES(2,'Dataset',1,'scores')");
        var config = new Request(2L,"line","score","COUNT","score","DESC",List.of(new Filter("subject","EQ","Toán")),new Bucket(BigDecimal.ZERO,BigDecimal.TEN,BigDecimal.ONE));
        var created = repository.save(null,"Phổ điểm",config);
        assertEquals(created,new ChartRepository(jdbc).get(created.id()));
        assertEquals(config,repository.get(created.id()).configuration());
        assertEquals(1,repository.list().size());
        assertEquals("Đã sửa",repository.save(created.id(),"Đã sửa",config).name());
        assertThrows(Exception.class, () -> jdbc.update("DELETE FROM datasets WHERE id=2"));
        assertThrows(ApiFailure.class, () -> repository.save(null,"Invalid",new Request(999L,"bar","score","AVG","score","ASC",List.of())));
        assertEquals(1,repository.list().size());
    }
}
