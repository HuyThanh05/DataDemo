package com.datademo.backend.connections.repository;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.connections.dto.ConnectionDtos.View;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public View update(long id, Input input, String password) {
        try {
            if(jdbc.query("SELECT id FROM database_connections WHERE id=? FOR UPDATE",(r,i)->r.getLong(1),id).isEmpty()) throw missing();
            View old=get(id);
            int count=jdbc.queryForObject("SELECT COUNT(*) FROM datasets WHERE connection_id=?",Integer.class,id);
            if(count>0 && (!old.host().equals(input.host()) || old.port()!=input.port() || !old.databaseName().equals(input.databaseName())))
                throw new ApiFailure(HttpStatus.CONFLICT,"CONNECTION_IN_USE","Connection has datasets. Create a new connection to change host, port or database.");
            jdbc.update("UPDATE database_connections SET name=?,host=?,port=?,database_name=?,username=?,encrypted_password=? WHERE id=?",input.name(),input.host(),input.port(),input.databaseName(),input.username(),password,id);
            return get(id);
        } catch(DataAccessException e){throw unavailable();}
    }
    @Transactional
    public void delete(long id) {
        try {
            if (jdbc.query("SELECT id FROM database_connections WHERE id=? FOR UPDATE", (r, i) -> r.getLong(1), id).isEmpty()) throw missing();
            int count = jdbc.queryForObject("SELECT COUNT(*) FROM datasets WHERE connection_id=?", Integer.class, id);
            if (count > 0) throw new ApiFailure(HttpStatus.CONFLICT, "CONNECTION_IN_USE",
                    "Không thể xóa kết nối: đang có " + count + " dataset sử dụng. Hãy xóa các dataset đó trước.");
            jdbc.update("DELETE FROM database_connections WHERE id=?", id);
        } catch (DataIntegrityViolationException e) {
            throw new ApiFailure(HttpStatus.CONFLICT, "CONNECTION_IN_USE", "Kết nối đang được sử dụng. Hãy tải lại danh sách dataset trước khi xóa.");
        } catch (DataAccessException e) { throw unavailable(); }
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
