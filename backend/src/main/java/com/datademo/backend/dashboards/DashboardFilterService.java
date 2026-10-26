package com.datademo.backend.dashboards;

import com.datademo.backend.charts.*;
import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.repository.DatasetRepository;
import com.datademo.backend.datasets.dto.DatasetDtos;
import com.datademo.backend.datasource.DistinctValues;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import static com.datademo.backend.dashboards.DashboardDtos.*;

@Service
public class DashboardFilterService {
    private final DashboardRepository dashboards;
    private final ChartRepository charts;
    private final DatasetRepository datasets;
    private final ConnectionService connections;
    private final ChartService chartService;
    public DashboardFilterService(DashboardRepository dashboards,ChartRepository charts,DatasetRepository datasets,ConnectionService connections,ChartService chartService) {
        this.dashboards=dashboards;this.charts=charts;this.datasets=datasets;this.connections=connections;this.chartService=chartService;
    }
    public CommonFilter get(long id) { return dashboards.filter(id); }
    public CommonFilter save(long id,CommonFilter filter) {
        if(filter==null) throw invalid();
        if(filter.datasetId()==null) {
            if(filter.column()!=null || filter.value()!=null) throw invalid();
        } else {
            var column=validate(id,filter.datasetId(),filter.column());
            if(filter.value()!=null) {
                if(filter.value().isBlank() || filter.value().length()>500) throw invalid();
                if(ChartQueryCompiler.numeric(column.dataType()) && !filter.value().trim().matches("[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)")) throw invalid();
            }
        }
        return dashboards.saveFilter(id,filter);
    }
    public DistinctValues values(long id,long datasetId,String column) {
        validate(id,datasetId,column);
        var dataset=datasets.get(datasetId);
        return connections.distinctValues(dataset.connectionId(),dataset.tableName(),column);
    }
    private DatasetDtos.Column validate(long id,long datasetId,String column) {
        if(datasetId<1 || column==null || column.isBlank() || column.length()>64) throw invalid();
        boolean belongs=dashboards.chartIds(id).stream().map(charts::get).anyMatch(chart->chart.configuration().datasetId()==datasetId);
        if(!belongs) throw invalid();
        var dataset=datasets.get(datasetId);
        var saved=dataset.columns().stream().filter(c->c.name().equals(column) && c.canFilter()).findFirst().orElseThrow(this::invalid);
        var live=connections.columns(dataset.connectionId(),dataset.tableName()).stream().filter(c->c.name().equals(column)).findFirst().orElseThrow(this::invalid);
        return new DatasetDtos.Column(saved.id(),saved.name(),saved.displayName(),live.dataType(),live.nullable(),saved.canGroup(),saved.canAggregate(),saved.canFilter());
    }
    public ChartDtos.Preview preview(long id,long chartId) {
        if(!dashboards.chartIds(id).contains(chartId)) throw new ApiFailure(HttpStatus.NOT_FOUND,"DASHBOARD_CHART_NOT_FOUND","Biểu đồ không thuộc dashboard này.");
        var chart=charts.get(chartId);var filter=get(id);
        ChartDtos.Filter extra=filter.datasetId()!=null && filter.datasetId().equals(chart.configuration().datasetId()) && filter.value()!=null
                ?new ChartDtos.Filter(filter.column(),"EQ",filter.value()):null;
        return chartService.previewForDashboard(chart,extra);
    }
    private ApiFailure invalid() { return new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_DASHBOARD_FILTER","Hãy chọn dataset, cột được phép lọc và giá trị hợp lệ cho dashboard."); }
}
