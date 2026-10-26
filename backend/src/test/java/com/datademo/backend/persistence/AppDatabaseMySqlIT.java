package com.datademo.backend.persistence;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Properties;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in only: ./mvnw.cmd -Dtest=AppDatabaseMySqlIT test
 * Applies the real migration to the locally configured datademo_app only.
 */
class AppDatabaseMySqlIT {
    @Test void migrateExistingLocalAppWithoutChangingConnectionRows() throws Exception {
        Properties properties = new Properties();
        try (Reader reader = Files.newBufferedReader(Path.of("application-local.properties"), StandardCharsets.UTF_8)) {
            properties.load(reader);
        }
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(properties.getProperty("datademo.app.url",
                "jdbc:mysql://localhost:3306/datademo_app?connectTimeout=5000&socketTimeout=10000"));
        config.setUsername(properties.getProperty("datademo.app.username", "datademo_app_user"));
        config.setPassword(properties.getProperty("datademo.app.password"));
        config.setMaximumPoolSize(2);
        config.setConnectionTimeout(5000);
        try (var pool = new HikariDataSource(config)) {
            try (var connection = pool.getConnection()) {
                assertEquals("datademo_app", connection.getCatalog(), "This check may only migrate datademo_app");
            }
            var jdbc = new JdbcTemplate(pool);
            boolean existing = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='database_connections'", Integer.class) > 0;
            byte[] before = existing ? digest(jdbc) : null;
            var flyway = Flyway.configure().dataSource(pool).locations("classpath:db/migration")
                    .baselineOnMigrate(true).baselineVersion("0").cleanDisabled(true).load();
            flyway.migrate();
            if (existing) assertArrayEquals(before, digest(jdbc), "Existing configuration and ciphertext must not change");
            assertEquals("7", flyway.info().current().getVersion().toString());
            assertEquals(0, flyway.migrate().migrationsExecuted);
            assertEquals(0, pool.getHikariPoolMXBean().getActiveConnections());
        }
    }

    private byte[] digest(JdbcTemplate jdbc) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        jdbc.query("SELECT id,name,host,port,database_name,username,encrypted_password,created_at FROM database_connections ORDER BY id", row -> {
            for (int column = 1; column <= 8; column++) {
                byte[] value = String.valueOf(row.getObject(column)).getBytes(StandardCharsets.UTF_8);
                digest.update(java.nio.ByteBuffer.allocate(4).putInt(value.length).array());
                digest.update(value);
            }
        });
        return digest.digest();
    }
}

