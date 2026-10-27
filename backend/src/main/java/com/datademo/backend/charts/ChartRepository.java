package com.datademo.backend.charts;

import com.datademo.backend.common.ApiFailure;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import static com.datademo.backend.charts.ChartDtos.*;

@Repository
public class ChartRepository {
    private final JdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();
    public ChartRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public List<Saved> list() {
        try { return jdbc.query("SELECT id,name,configuration_json FROM charts ORDER BY id DESC", (r,i) -> new Saved(r.getLong(1),r.getString(2),json.readValue(r.getString(3),Request.class))); }
        catch (Exception e) { throw unavailable(); }
    }
    public Saved get(long id) {
        List<Saved> rows;
        try { rows = jdbc.query("SELECT id,name,configuration_json FROM charts WHERE id=?", (r,i) -> new Saved(r.getLong(1),r.getString(2),json.readValue(r.getString(3),Request.class)),id); }
        catch (Exception e) { throw unavailable(); }
        if (rows.isEmpty()) throw new ApiFailure(HttpStatus.NOT_FOUND,"CHART_NOT_FOUND","Không tìm thấy biểu đồ.");
        return rows.getFirst();
    }
    @Transactional public Saved save(Long id, String name, Request configuration) {
        if (id != null) get(id);
        try {
            String encoded = json.writeValueAsString(configuration);
            if (id == null) {
                var keys = new GeneratedKeyHolder();
                jdbc.update(c -> { var s = c.prepareStatement("INSERT INTO charts(name,dataset_id,configuration_json) VALUES(?,?,?)",new String[]{"id"}); s.setString(1,name);s.setLong(2,configuration.datasetId());s.setString(3,encoded);return s; },keys);
                id = keys.getKey().longValue();
            } else jdbc.update("UPDATE charts SET name=?,dataset_id=?,configuration_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",name,configuration.datasetId(),encoded,id);
            return get(id);
        } catch (Exception e) { throw unavailable(); }
    }
    @Transactional public void delete(long id) {
        try {
            if (jdbc.query("SELECT id FROM charts WHERE id=? FOR UPDATE", (r,i) -> r.getLong(1),id).isEmpty())
                throw new ApiFailure(HttpStatus.NOT_FOUND,"CHART_NOT_FOUND","Không tìm thấy biểu đồ.");
            int count = jdbc.queryForObject("SELECT COUNT(*) FROM dashboard_charts WHERE chart_id=?",Integer.class,id);
            if (count > 0) throw new ApiFailure(HttpStatus.CONFLICT,"CHART_IN_USE",
                    "Không thể xóa biểu đồ: đang có " + count + " dashboard sử dụng. Hãy gỡ biểu đồ khỏi các dashboard đó trước.");
            jdbc.update("DELETE FROM charts WHERE id=?",id);
        } catch (DataIntegrityViolationException e) {
            throw new ApiFailure(HttpStatus.CONFLICT,"CHART_IN_USE","Biểu đồ đang được sử dụng. Hãy tải lại các dashboard trước khi xóa.");
        } catch (DataAccessException e) { throw unavailable(); }
    }
    private ApiFailure unavailable() { return new ApiFailure(HttpStatus.SERVICE_UNAVAILABLE,"APP_DATABASE_UNAVAILABLE","Không đọc hoặc lưu được cấu hình biểu đồ trong datademo_app."); }
}
