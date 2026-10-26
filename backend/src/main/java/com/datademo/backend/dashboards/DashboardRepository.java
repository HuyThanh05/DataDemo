package com.datademo.backend.dashboards;

import com.datademo.backend.common.ApiFailure;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import static com.datademo.backend.dashboards.DashboardDtos.*;

@Repository
public class DashboardRepository {
    private final JdbcTemplate jdbc;
    public DashboardRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public List<View> list() {
        try { return jdbc.query("SELECT id,name FROM dashboards ORDER BY id DESC",(r,i) -> new View(r.getLong(1),r.getString(2))); }
        catch (DataAccessException e) { throw unavailable(); }
    }
    public View get(long id) {
        List<View> rows;
        try { rows = jdbc.query("SELECT id,name FROM dashboards WHERE id=?",(r,i) -> new View(r.getLong(1),r.getString(2)),id); }
        catch (DataAccessException e) { throw unavailable(); }
        if (rows.isEmpty()) throw new ApiFailure(HttpStatus.NOT_FOUND,"DASHBOARD_NOT_FOUND","Không tìm thấy dashboard.");
        return rows.getFirst();
    }
    @Transactional public View save(Long id, String name) {
        if (id != null) get(id);
        try {
            if (id == null) {
                var keys = new GeneratedKeyHolder();
                jdbc.update(c -> { var s = c.prepareStatement("INSERT INTO dashboards(name) VALUES(?)",new String[]{"id"});s.setString(1,name);return s; },keys);
                Number key = keys.getKey(); if (key == null) throw unavailable();
                id = key.longValue();
            } else jdbc.update("UPDATE dashboards SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",name,id);
            return get(id);
        } catch (DataAccessException e) { throw unavailable(); }
    }
    public List<Long> chartIds(long dashboardId) {
        get(dashboardId);
        try { return jdbc.query("SELECT chart_id FROM dashboard_charts WHERE dashboard_id=? ORDER BY added_at,chart_id",(r,i) -> r.getLong(1),dashboardId); }
        catch (DataAccessException e) { throw unavailable(); }
    }
    @Transactional public void addChart(long dashboardId,long chartId) {
        lock(dashboardId);
        try {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM dashboard_charts WHERE dashboard_id=? AND chart_id=?",Integer.class,dashboardId,chartId);
            if (count == null || count == 0) {
                jdbc.update("INSERT INTO dashboard_charts(dashboard_id,chart_id) VALUES(?,?)",dashboardId,chartId);
                jdbc.update("UPDATE dashboards SET updated_at=CURRENT_TIMESTAMP WHERE id=?",dashboardId);
            }
        } catch (DataAccessException e) { throw unavailable(); }
    }
    @Transactional public void removeChart(long dashboardId,long chartId) {
        lock(dashboardId);
        try {
            if (jdbc.update("DELETE FROM dashboard_charts WHERE dashboard_id=? AND chart_id=?",dashboardId,chartId) > 0)
                jdbc.update("UPDATE dashboards SET updated_at=CURRENT_TIMESTAMP WHERE id=?",dashboardId);
        } catch (DataAccessException e) { throw unavailable(); }
    }
    public CommonFilter filter(long dashboardId) {
        get(dashboardId);
        try {
            var rows=jdbc.query("SELECT dataset_id,column_name,selected_value FROM dashboard_filters WHERE dashboard_id=?",(r,i)->new CommonFilter(r.getLong(1),r.getString(2),r.getString(3)),dashboardId);
            return rows.isEmpty()?new CommonFilter(null,null,null):rows.getFirst();
        } catch(DataAccessException e) { throw unavailable(); }
    }
    @Transactional public CommonFilter saveFilter(long dashboardId,CommonFilter filter) {
        lock(dashboardId);
        if(filter.datasetId()!=null) {
            boolean linked=jdbc.queryForObject("SELECT COUNT(*) FROM dashboard_charts dc JOIN charts c ON c.id=dc.chart_id WHERE dc.dashboard_id=? AND c.dataset_id=?",Integer.class,dashboardId,filter.datasetId())>0;
            if(!linked) throw new ApiFailure(HttpStatus.CONFLICT,"DASHBOARD_CHANGED","Dataset không còn được dùng trên dashboard. Hãy chọn lại nguồn lọc.");
        }
        try {
            jdbc.update("DELETE FROM dashboard_filters WHERE dashboard_id=?",dashboardId);
            if(filter.datasetId()!=null) jdbc.update("INSERT INTO dashboard_filters(dashboard_id,dataset_id,column_name,selected_value) VALUES(?,?,?,?)",dashboardId,filter.datasetId(),filter.column(),filter.value());
            jdbc.update("UPDATE dashboards SET updated_at=CURRENT_TIMESTAMP WHERE id=?",dashboardId);
            return filter(dashboardId);
        } catch(DataAccessException e) { throw unavailable(); }
    }
    private void lock(long dashboardId) {
        List<Long> ids;
        try { ids = jdbc.query("SELECT id FROM dashboards WHERE id=? FOR UPDATE",(r,i) -> r.getLong(1),dashboardId); }
        catch (DataAccessException e) { throw unavailable(); }
        if (ids.isEmpty()) throw new ApiFailure(HttpStatus.NOT_FOUND,"DASHBOARD_NOT_FOUND","Không tìm thấy dashboard.");
    }
    public List<LayoutItem> layout(long dashboardId) {
        get(dashboardId);
        try {
            var rows = jdbc.query("SELECT dc.chart_id,l.grid_x,l.grid_y,l.grid_w,l.grid_h FROM dashboard_charts dc LEFT JOIN dashboard_chart_layouts l ON l.dashboard_id=dc.dashboard_id AND l.chart_id=dc.chart_id WHERE dc.dashboard_id=? ORDER BY dc.added_at,dc.chart_id",(r,i) -> new LayoutItem(r.getLong(1),r.getObject(2,Integer.class),r.getObject(3,Integer.class),r.getObject(4,Integer.class),r.getObject(5,Integer.class)),dashboardId);
            int bottom = rows.stream().filter(item -> item.y()!=null).mapToInt(item -> item.y()+item.h()).max().orElse(0);
            var result = new java.util.ArrayList<LayoutItem>(); int pending = 0;
            for(var item:rows) {
                if(item.x()!=null) result.add(item);
                else { result.add(new LayoutItem(item.chartId(),(pending%2)*6,bottom+(pending/2)*12,6,12));pending++; }
            }
            return result;
        } catch(DataAccessException e) { throw unavailable(); }
    }
    @Transactional public List<LayoutItem> saveLayout(long dashboardId,List<LayoutItem> items) {
        lock(dashboardId);
        var actual = new java.util.HashSet<>(chartIds(dashboardId));
        var requested = new java.util.HashSet<>(items.stream().map(LayoutItem::chartId).toList());
        if(!actual.equals(requested)) throw new ApiFailure(HttpStatus.CONFLICT,"DASHBOARD_CHANGED","Danh sách biểu đồ đã thay đổi. Hãy tải lại bố cục trước khi lưu.");
        try {
            for(var item:items) {
                int count=jdbc.queryForObject("SELECT COUNT(*) FROM dashboard_chart_layouts WHERE dashboard_id=? AND chart_id=?",Integer.class,dashboardId,item.chartId());
                if(count==0) jdbc.update("INSERT INTO dashboard_chart_layouts(dashboard_id,chart_id,grid_x,grid_y,grid_w,grid_h) VALUES(?,?,?,?,?,?)",dashboardId,item.chartId(),item.x(),item.y(),item.w(),item.h());
                else jdbc.update("UPDATE dashboard_chart_layouts SET grid_x=?,grid_y=?,grid_w=?,grid_h=? WHERE dashboard_id=? AND chart_id=?",item.x(),item.y(),item.w(),item.h(),dashboardId,item.chartId());
            }
            jdbc.update("UPDATE dashboards SET updated_at=CURRENT_TIMESTAMP WHERE id=?",dashboardId);
            return layout(dashboardId);
        } catch(DataAccessException e) { throw unavailable(); }
    }
    private ApiFailure unavailable() { return new ApiFailure(HttpStatus.SERVICE_UNAVAILABLE,"APP_DATABASE_UNAVAILABLE","Không đọc hoặc lưu được dashboard trong datademo_app."); }
}
