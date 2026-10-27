package com.datademo.backend.charts;

import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.repository.DatasetRepository;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import org.springframework.stereotype.Service;
import static com.datademo.backend.charts.ChartDtos.*;

@Service
public class ChartService {
    private final DatasetRepository datasets;
    private final ConnectionService connections;
    private final ChartQueryCompiler compiler;
    private final ChartRepository repository;
    public ChartService(DatasetRepository datasets, ConnectionService connections, ChartQueryCompiler compiler, ChartRepository repository) {
        this.datasets = datasets; this.connections = connections; this.compiler = compiler; this.repository = repository;
    }
    public java.util.List<Saved> list() { return repository.list(); }
    public Saved get(long id) { return repository.get(id); }
    public void delete(long id) { repository.delete(id); }
    public Saved save(Long id, Save input) {
        if (input == null || input.name() == null || input.name().isBlank() || input.name().trim().length() > 100) throw ChartQueryCompiler.invalid();
        validate(input.configuration());
        return repository.save(id,input.name().trim(),input.configuration());
    }
    public Preview preview(Request input) {
        return execute(input,10);
    }
    public Preview previewForDashboard(Saved chart,Filter extra) {
        var input=chart.configuration();
        if(extra==null) return preview(input);
        var filters=new java.util.ArrayList<Filter>(input.filters()==null?java.util.List.of():input.filters());
        filters.add(extra);
        return execute(new Request(input.datasetId(),input.chartType(),input.dimension(),input.aggregation(),input.metricColumn(),input.sortDirection(),filters,input.bucket()),11);
    }
    private Preview execute(Request input,int maxFilters) {
        var plan = validate(input,maxFilters);
        Detail saved = datasets.get(input.datasetId());
        return connections.aggregate(saved.connectionId(), saved.tableName(), plan);
    }
    private Plan validate(Request input) {
        return validate(input,10);
    }
    private Plan validate(Request input,int maxFilters) {
        if (input == null || input.datasetId() == null || input.datasetId() < 1) throw ChartQueryCompiler.invalid();
        Detail saved = datasets.get(input.datasetId());
        // Recheck live schema so stale saved types cannot enable AVG on a text column.
        var live = connections.columns(saved.connectionId(), saved.tableName());
        var columns = saved.columns().stream().filter(c -> live.stream().anyMatch(l -> l.name().equals(c.name())))
                .map(c -> { var l = live.stream().filter(v -> v.name().equals(c.name())).findFirst().orElseThrow();
                    return new Column(c.id(), c.name(), c.displayName(), l.dataType(), l.nullable(), c.canGroup(), c.canAggregate(), c.canFilter()); }).toList();
        var plan = compiler.compile(input, new Detail(saved.id(), saved.name(), saved.connectionId(), saved.tableName(), columns),maxFilters);
        return plan;
    }
}
