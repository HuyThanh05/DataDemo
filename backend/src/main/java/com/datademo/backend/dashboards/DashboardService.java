package com.datademo.backend.dashboards;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.charts.ChartRepository;
import com.datademo.backend.charts.ChartDtos.Saved;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import static com.datademo.backend.dashboards.DashboardDtos.*;

@Service
public class DashboardService {
    private final DashboardRepository repository;
    private final ChartRepository charts;
    public DashboardService(DashboardRepository repository, ChartRepository charts) { this.repository = repository; this.charts = charts; }
    public List<Saved> charts(long dashboardId) { return repository.chartIds(dashboardId).stream().map(charts::get).toList(); }
    public List<Saved> addChart(long dashboardId, AddChart input) {
        if (input == null || input.chartId() == null || input.chartId() < 1) throw new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_CHART","Hãy chọn biểu đồ đã lưu.");
        repository.get(dashboardId); charts.get(input.chartId());
        repository.addChart(dashboardId,input.chartId());
        return charts(dashboardId);
    }
    public List<Saved> removeChart(long dashboardId, long chartId) {
        if (chartId < 1) throw new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_CHART","Mã biểu đồ không hợp lệ.");
        repository.removeChart(dashboardId,chartId);
        return charts(dashboardId);
    }
    public List<View> list() { return repository.list(); }
    public List<LayoutItem> layout(long dashboardId) { return repository.layout(dashboardId); }
    public List<LayoutItem> saveLayout(long dashboardId,LayoutSave input) {
        if(input == null || input.items() == null) throw invalidLayout();
        var ids = new java.util.HashSet<Long>();
        for(var item:input.items()) {
            if(item == null || item.chartId()==null || item.chartId()<1 || !ids.add(item.chartId()) || item.x()==null || item.y()==null || item.w()==null || item.h()==null
                    || item.x()<0 || item.y()<0 || item.y()>10000 || item.w()<4 || item.w()>12 || item.x()>12-item.w() || item.h()<8 || item.h()>40) throw invalidLayout();
        }
        for(int i=0;i<input.items().size();i++) for(int j=i+1;j<input.items().size();j++) {
            var a=input.items().get(i); var b=input.items().get(j);
            if(a.x()<b.x()+b.w() && a.x()+a.w()>b.x() && a.y()<b.y()+b.h() && a.y()+a.h()>b.y()) throw invalidLayout();
        }
        return repository.saveLayout(dashboardId,input.items());
    }
    private ApiFailure invalidLayout() { return new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_LAYOUT","Bố cục không hợp lệ: biểu đồ không được trùng, chồng lấn hoặc vượt giới hạn lưới 12 cột."); }
    public View get(long id) { return repository.get(id); }
    public View save(Long id, Save input) {
        if (input == null || input.name() == null || input.name().isBlank() || input.name().trim().length() > 100)
            throw new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_DASHBOARD","Tên dashboard phải có từ 1 đến 100 ký tự.");
        return repository.save(id,input.name().trim());
    }
}
