package com.datademo.backend.datasets;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.datasets.dto.DatasetDtos.Column;
import com.datademo.backend.datasets.repository.DatasetRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:datasets;MODE=MySQL;DB_CLOSE_DELAY=-1", "spring.datasource.username=sa", "spring.datasource.password=", "spring.config.import=optional:classpath:absent-test.properties"})
class DatasetPersistenceTests {
    @Autowired DatasetRepository repository;
    @Autowired JdbcTemplate jdbc;
    private void source() {
        jdbc.update("DELETE FROM dataset_columns"); jdbc.update("DELETE FROM datasets"); jdbc.update("DELETE FROM database_connections");
        jdbc.update("INSERT INTO database_connections(id,name,host,port,database_name,username,encrypted_password) VALUES(7,'Demo','localhost',3306,'source','reader','ciphertext')");
    }
    @Test void savesReopensAndRenamesWithoutChangingSourceReference() {
        source();
        var saved = repository.create("Demo",7,"scores",List.of(new Column(0,"score","Điểm thi","decimal(4,2)",true,true,true,true)));
        assertEquals(saved,repository.get(saved.id()));
        assertEquals(1,repository.list().size());
        repository.update(saved.id(),"Tên mới",Map.of("score","Điểm"));
        var restored = repository.get(saved.id());
        assertEquals("Tên mới",restored.name()); assertEquals("Điểm",restored.columns().getFirst().displayName());
        assertEquals(7,restored.connectionId()); assertEquals("scores",restored.tableName());
        assertThrows(Exception.class,()->jdbc.update("DELETE FROM database_connections WHERE id=7"));
    }
    @Test void policiesPersistAndUsedAggregationsCannotBeRemoved() {
        source();
        var created=repository.create("Sales",7,"sales",List.of(new Column(0,"revenue","Doanh thu","decimal",true,true,true,true)));
        var settings=new com.datademo.backend.datasets.dto.DatasetDtos.ColumnSettings("MEASURE",List.of("SUM","COUNT"),"SUM");
        repository.updateSettings(created.id(),"Sales",Map.of(),Map.of("revenue",settings));
        var column=repository.get(created.id()).columns().getFirst();
        assertEquals("MEASURE",column.role()); assertEquals(List.of("SUM","COUNT"),column.allowedAggregations()); assertEquals("SUM",column.defaultAggregation());
        jdbc.update("INSERT INTO charts(name,dataset_id,configuration_json) VALUES(?,?,?)","Total",created.id(),"{\"datasetId\":"+created.id()+",\"chartType\":\"bar\",\"dimension\":\"revenue\",\"aggregation\":\"SUM\",\"metricColumn\":\"revenue\",\"sortDirection\":\"ASC\",\"filters\":[]}");
        try {
            assertThrows(ApiFailure.class,()->repository.updateSettings(created.id(),"Changed",Map.of(),Map.of("revenue",new com.datademo.backend.datasets.dto.DatasetDtos.ColumnSettings("IDENTIFIER",List.of("COUNT"),"COUNT"))));
            assertEquals("SUM",repository.get(created.id()).columns().getFirst().defaultAggregation());
            assertEquals("Sales",repository.get(created.id()).name());
        } finally { jdbc.update("DELETE FROM charts WHERE dataset_id=?",created.id()); }
    }
    @Test void columnFailureRollsBackWholeDataset() {
        source();
        var column = new Column(0,"score","Điểm","decimal",false,true,true,true);
        assertThrows(ApiFailure.class,()->repository.create("Invalid",7,"scores",List.of(column,column)));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM datasets",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM dataset_columns",Integer.class));
    }
}
