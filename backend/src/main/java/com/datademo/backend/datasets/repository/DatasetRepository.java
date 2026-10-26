package com.datademo.backend.datasets.repository;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class DatasetRepository {
    private final JdbcTemplate jdbc;
    public DatasetRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Summary> list() {
        try {
            return jdbc.query("SELECT id,name,connection_id,table_name FROM datasets ORDER BY id DESC",
                    (r, n) -> new Summary(r.getLong(1), r.getString(2), r.getLong(3), r.getString(4)));
        } catch (DataAccessException e) { throw unavailable(); }
    }

    @Transactional(readOnly = true)
    public Detail get(long id) {
        try {
            var rows = jdbc.query("SELECT id,name,connection_id,table_name FROM datasets WHERE id=?",
                    (r, n) -> new Summary(r.getLong(1), r.getString(2), r.getLong(3), r.getString(4)), id);
            if (rows.isEmpty()) throw new ApiFailure(HttpStatus.NOT_FOUND, "DATASET_NOT_FOUND", "Không tìm thấy dataset.");
            var columns = jdbc.query("SELECT id,column_name,display_name,data_type,is_nullable,can_group,can_aggregate,can_filter FROM dataset_columns WHERE dataset_id=? ORDER BY ordinal_position",
                    (r, n) -> new Column(r.getLong(1), r.getString(2), r.getString(3), r.getString(4), r.getBoolean(5), r.getBoolean(6), r.getBoolean(7), r.getBoolean(8)), id);
            var row = rows.getFirst();
            return new Detail(row.id(), row.name(), row.connectionId(), row.tableName(), columns);
        } catch (DataAccessException e) { throw unavailable(); }
    }

    @Transactional
    public Detail create(String name, long connectionId, String table, List<Column> columns) {
        try {
            var keys = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                var statement = connection.prepareStatement("INSERT INTO datasets(name,connection_id,table_name) VALUES(?,?,?)", new String[] { "id" });
                statement.setString(1, name); statement.setLong(2, connectionId); statement.setString(3, table);
                return statement;
            }, keys);
            Number key = keys.getKey();
            if (key == null) throw unavailable();
            long id = key.longValue();
            int position = 0;
            for (Column c : columns) {
                jdbc.update("INSERT INTO dataset_columns(dataset_id,column_name,display_name,data_type,is_nullable,ordinal_position,can_group,can_aggregate,can_filter) VALUES(?,?,?,?,?,?,?,?,?)",
                        id, c.name(), c.displayName(), c.dataType(), c.nullable(), position++, c.canGroup(), c.canAggregate(), c.canFilter());
            }
            return get(id);
        } catch (DataAccessException e) { throw unavailable(); }
    }

    @Transactional
    public Detail update(long id, String name, Map<String, String> labels) {
        try {
            if (jdbc.update("UPDATE datasets SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", name, id) != 1) {
                throw new ApiFailure(HttpStatus.NOT_FOUND, "DATASET_NOT_FOUND", "Không tìm thấy dataset.");
            }
            for (var entry : labels.entrySet()) {
                jdbc.update("UPDATE dataset_columns SET display_name=? WHERE dataset_id=? AND column_name=?", entry.getValue(), id, entry.getKey());
            }
            return get(id);
        } catch (DataAccessException e) { throw unavailable(); }
    }

    private ApiFailure unavailable() {
        return new ApiFailure(HttpStatus.SERVICE_UNAVAILABLE, "APP_DATABASE_UNAVAILABLE", "Không lưu hoặc đọc được dataset. Kiểm tra datademo_app và migration của backend.");
    }
}
