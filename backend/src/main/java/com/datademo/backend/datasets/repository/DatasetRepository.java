package com.datademo.backend.datasets.repository;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import java.util.List;
import java.util.Map;
import java.util.Arrays;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
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
            var columns = jdbc.query("SELECT c.id,c.column_name,c.display_name,c.data_type,c.is_nullable,c.can_group,c.can_aggregate,c.can_filter,s.role,s.allowed_aggregations,s.default_aggregation FROM dataset_columns c LEFT JOIN dataset_column_settings s ON s.column_id=c.id WHERE c.dataset_id=? ORDER BY c.ordinal_position",
                    (r, n) -> new Column(r.getLong(1), r.getString(2), r.getString(3), r.getString(4), r.getBoolean(5), r.getBoolean(6), r.getBoolean(7), r.getBoolean(8),
                        r.getString(9)==null?(r.getBoolean(7)?"MEASURE":"DIMENSION"):r.getString(9),
                        r.getString(10)==null?(r.getBoolean(7)?List.of("COUNT","SUM","AVG","MIN","MAX"):List.of("COUNT")):(r.getString(10).isEmpty()?List.of():Arrays.asList(r.getString(10).split(","))),
                        r.getString(9)==null?(r.getBoolean(7)?"AVG":"COUNT"):r.getString(11)), id);
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
                long columnId=jdbc.queryForObject("SELECT id FROM dataset_columns WHERE dataset_id=? AND column_name=?",Long.class,id,c.name());
                jdbc.update("INSERT INTO dataset_column_settings(column_id,role,allowed_aggregations,default_aggregation) VALUES(?,?,?,?)",columnId,c.role(),String.join(",",c.allowedAggregations()),c.defaultAggregation());
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

    @Transactional
    public Detail updateSettings(long id,String name,Map<String,String> labels,Map<String,ColumnSettings> settings) {
        if(jdbc.query("SELECT id FROM datasets WHERE id=? FOR UPDATE",(r,i)->r.getLong(1),id).isEmpty())
            throw new ApiFailure(HttpStatus.NOT_FOUND,"DATASET_NOT_FOUND","Không tìm thấy dataset.");
        var json=JsonMapper.builder().build();
        var charts=jdbc.query("SELECT configuration_json FROM charts WHERE dataset_id=?",(r,i)->json.readValue(r.getString(1),com.datademo.backend.charts.ChartDtos.Request.class),id);
        for(var chart:charts) {
            var policy=settings.get(chart.metricColumn());
            if(policy!=null && !policy.allowedAggregations().contains(chart.aggregation()))
                throw new ApiFailure(HttpStatus.CONFLICT,"AGGREGATION_IN_USE","Phép tính đang được biểu đồ đã lưu sử dụng. Hãy sửa hoặc xóa biểu đồ đó trước khi bỏ phép tính.");
        }
        for(var entry:settings.entrySet()) {
            long columnId=jdbc.queryForObject("SELECT id FROM dataset_columns WHERE dataset_id=? AND column_name=?",Long.class,id,entry.getKey());
            var policy=entry.getValue();
            jdbc.update("DELETE FROM dataset_column_settings WHERE column_id=?",columnId);
            jdbc.update("INSERT INTO dataset_column_settings(column_id,role,allowed_aggregations,default_aggregation) VALUES(?,?,?,?)",columnId,policy.role(),String.join(",",policy.allowedAggregations()),policy.defaultAggregation());
        }
        return update(id,name,labels);
    }

    @Transactional
    public void delete(long id) {
        try {
            if (jdbc.query("SELECT id FROM datasets WHERE id=? FOR UPDATE", (r, i) -> r.getLong(1), id).isEmpty())
                throw new ApiFailure(HttpStatus.NOT_FOUND, "DATASET_NOT_FOUND", "Không tìm thấy dataset.");
            int charts = jdbc.queryForObject("SELECT COUNT(*) FROM charts WHERE dataset_id=?", Integer.class, id);
            if (charts > 0) throw new ApiFailure(HttpStatus.CONFLICT, "DATASET_IN_USE",
                    "Không thể xóa dataset: đang có " + charts + " biểu đồ sử dụng. Hãy xóa các biểu đồ đó trước.");
            int filters = jdbc.queryForObject("SELECT COUNT(*) FROM dashboard_filters WHERE dataset_id=?", Integer.class, id);
            if (filters > 0) throw new ApiFailure(HttpStatus.CONFLICT, "DATASET_IN_USE",
                    "Không thể xóa dataset: đang được dùng làm bộ lọc của " + filters + " dashboard. Hãy tắt bộ lọc chung trên các dashboard đó trước.");
            jdbc.update("DELETE FROM dataset_columns WHERE dataset_id=?", id);
            jdbc.update("DELETE FROM datasets WHERE id=?", id);
        } catch (DataIntegrityViolationException e) {
            throw new ApiFailure(HttpStatus.CONFLICT, "DATASET_IN_USE", "Dataset đang được sử dụng. Hãy tải lại biểu đồ và bộ lọc dashboard trước khi xóa.");
        } catch (DataAccessException e) { throw unavailable(); }
    }

    private ApiFailure unavailable() {
        return new ApiFailure(HttpStatus.SERVICE_UNAVAILABLE, "APP_DATABASE_UNAVAILABLE", "Không lưu hoặc đọc được dataset. Kiểm tra datademo_app và migration của backend.");
    }
}
