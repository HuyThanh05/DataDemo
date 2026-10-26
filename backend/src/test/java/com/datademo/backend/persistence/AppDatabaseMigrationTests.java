package com.datademo.backend.persistence;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.connections.repository.ConnectionRepository;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import static org.junit.jupiter.api.Assertions.*;

class AppDatabaseMigrationTests {
    private HikariDataSource pool() {
        var config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        config.setUsername("sa");
        config.setMaximumPoolSize(2);
        return new HikariDataSource(config);
    }

    private Flyway flyway(HikariDataSource pool) {
        return Flyway.configure().dataSource(pool).locations("classpath:db/migration")
                .baselineOnMigrate(true).baselineVersion("0").cleanDisabled(true).load();
    }

    @Test void freshDatabaseMigratesOnceAndRepositoryUsesPool() {
        try (var pool = pool()) {
            var flyway = flyway(pool);
            assertEquals(7, flyway.migrate().migrationsExecuted);
            assertEquals(0, flyway.migrate().migrationsExecuted);
            var jdbc = new JdbcTemplate(pool);
            var repository = new ConnectionRepository(jdbc);
            var input = new Input("Nguồn mẫu", "localhost", 3306, "source", "reader", "not-persisted-plaintext");
            var created = repository.save(input, "existing-ciphertext");
            assertEquals(created, repository.get(created.id()));
            assertEquals(1, repository.list().size());
            assertEquals("existing-ciphertext", repository.find(created.id()).encryptedPassword());
            assertThrows(ApiFailure.class, () -> repository.get(999));
            assertEquals(0, pool.getHikariPoolMXBean().getActiveConnections());
        }
    }

    @Test void existingPocRowsAndCiphertextSurviveBaselineAndRestart() {
        try (var pool = pool()) {
            // Emulate the table created by the pre-Flyway application.
            new ResourceDatabasePopulator(new ClassPathResource("db/migration/V1__create_database_connections.sql")).execute(pool);
            var jdbc = new JdbcTemplate(pool);
            jdbc.update("INSERT INTO database_connections(id,name,host,port,database_name,username,encrypted_password) VALUES(?,?,?,?,?,?,?)",
                    42, "Existing", "localhost", 3306, "source", "reader", "unchanged-iv:ciphertext");
            var flyway = flyway(pool);
            assertEquals(7, flyway.migrate().migrationsExecuted);
            assertEquals("7", flyway.info().current().getVersion().toString());
            assertEquals(0, flyway(pool).migrate().migrationsExecuted);
            assertEquals("unchanged-iv:ciphertext", jdbc.queryForObject("SELECT encrypted_password FROM database_connections WHERE id=42", String.class));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM database_connections", Integer.class));
            assertTrue(flyway.getConfiguration().isCleanDisabled());
        }
    }
}

