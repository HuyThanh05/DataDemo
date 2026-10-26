package com.datademo.backend.connections.repository;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.connections.dto.ConnectionDtos.View;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class ConnectionRepository {
    public record StoredConnection(View view, String encryptedPassword) {}
    private static final String PUBLIC_COLUMNS = "id,name,host,port,database_name,username";
    private final JdbcTemplate jdbc;

    public ConnectionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<View> list() {
        try {
            return jdbc.query("SELECT " + PUBLIC_COLUMNS + " FROM database_connections ORDER BY id DESC",
                    (row, index) -> view(row));
        } catch (DataAccessException e) {
            throw unavailable();
        }
    }

    public View get(long id) {
        try {
            List<View> rows = jdbc.query("SELECT " + PUBLIC_COLUMNS + " FROM database_connections WHERE id=?",
                    (row, index) -> view(row), id);
            if (rows.isEmpty()) throw missing();
            return rows.getFirst();
        } catch (DataAccessException e) {
            throw unavailable();
        }
    }

    public StoredConnection find(long id) {
        try {
            List<StoredConnection> rows = jdbc.query(
                    "SELECT " + PUBLIC_COLUMNS + ",encrypted_password FROM database_connections WHERE id=?",
                    (row, index) -> new StoredConnection(view(row), row.getString("encrypted_password")), id);
            if (rows.isEmpty()) throw missing();
            return rows.getFirst();
        } catch (DataAccessException e) {
            throw unavailable();
        }
    }

    public View save(Input input, String encryptedPassword) {
        try {
            var keys = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                var statement = connection.prepareStatement(
                        "INSERT INTO database_connections(name,host,port,database_name,username,encrypted_password) VALUES(?,?,?,?,?,?)",
                        new String[] { "id" });
                statement.setString(1, input.name());
                statement.setString(2, input.host());
                statement.setInt(3, input.port());
                statement.setString(4, input.databaseName());
                statement.setString(5, input.username());
                statement.setString(6, encryptedPassword);
                return statement;
            }, keys);
            Number id = keys.getKey();
            if (id == null) throw unavailable();
            return new View(id.longValue(), input.name(), input.host(), input.port(), input.databaseName(), input.username());
        } catch (DataAccessException e) {
            throw unavailable();
        }
    }

    private View view(ResultSet row) throws SQLException {
        return new View(row.getLong("id"), row.getString("name"), row.getString("host"),
                row.getInt("port"), row.getString("database_name"), row.getString("username"));
    }

    private ApiFailure missing() {
        return new ApiFailure(HttpStatus.NOT_FOUND, "CONNECTION_NOT_FOUND", "Không tìm thấy kết nối.");
    }

    private ApiFailure unavailable() {
        return new ApiFailure(HttpStatus.SERVICE_UNAVAILABLE, "APP_DATABASE_UNAVAILABLE",
                "Chưa truy cập được datademo_app. Cấu hình tài khoản ghi trong backend/application-local.properties theo docs/step-7.md.");
    }
}
