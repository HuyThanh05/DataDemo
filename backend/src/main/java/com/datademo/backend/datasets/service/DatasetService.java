package com.datademo.backend.datasets.service;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.dto.PreviewRequest;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import com.datademo.backend.datasets.repository.DatasetRepository;
import java.util.*;
import com.datademo.backend.datasource.TablePreview;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class DatasetService {
    private final ConnectionService connections;
    private final DatasetRepository repository;

    public DatasetService(ConnectionService connections, DatasetRepository repository) {
        this.connections = connections;
        this.repository = repository;
    }

    public List<Summary> list() { return repository.list(); }
    public Detail get(long id) { return repository.get(id); }

    public Detail create(Create request) {
        if (request == null) throw invalid("Thiếu thông tin dataset.");
        String name = name(request.name());
        validateSource(new PreviewRequest(request.connectionId(), request.tableName()));
        var metadata = connections.columns(request.connectionId(), request.tableName());
        if (metadata.isEmpty()) throw invalid("Bảng không có cột hợp lệ.");
        var labels = labels(request.columnLabels(), metadata.stream().map(c -> c.name()).toList());
        List<Column> columns = metadata.stream().map(c -> new Column(0, c.name(), labels.getOrDefault(c.name(), c.name()), c.dataType(), c.nullable(), true, numeric(c.dataType()), true)).toList();
        return repository.create(name, request.connectionId(), request.tableName(), columns);
    }

    public Detail update(long id, Patch request) {
        if (request == null) throw invalid("Thiếu thông tin dataset.");
        Detail current = repository.get(id);
        String name = request.name() == null ? current.name() : name(request.name());
        var labels = labels(request.columnLabels(), current.columns().stream().map(Column::name).toList());
        return repository.update(id, name, labels);
    }

    public TablePreview preview(long id) {
        Detail dataset = repository.get(id);
        return connections.previewTable(dataset.connectionId(), dataset.tableName());
    }

    private String name(String value) {
        if (value == null || value.isBlank() || value.trim().length() > 100) throw invalid("Tên dataset phải có từ 1 đến 100 ký tự.");
        return value.trim();
    }

    private Map<String, String> labels(Map<String, String> input, List<String> columns) {
        Map<String, String> result = new LinkedHashMap<>();
        if (input == null) return result;
        for (var entry : input.entrySet()) {
            if (!columns.contains(entry.getKey())) throw invalid("Tên cột không thuộc dataset.");
            String label = entry.getValue();
            label = label == null || label.isBlank() ? entry.getKey() : label.trim();
            if (label.length() > 100) throw invalid("Tên hiển thị tối đa 100 ký tự.");
            result.put(entry.getKey(), label);
        }
        return result;
    }

    private boolean numeric(String type) {
        return type.toLowerCase(Locale.ROOT).matches("^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)(\\b|\\().*");
    }

    private ApiFailure invalid(String message) { return new ApiFailure(HttpStatus.BAD_REQUEST, "INVALID_DATASET", message); }

    public TablePreview preview(PreviewRequest request) {
        validateSource(request);
        return connections.previewTable(request.connectionId(), request.tableName());
    }

    private void validateSource(PreviewRequest request) {
        if (request == null || request.connectionId() == null || request.connectionId() < 1
                || request.tableName() == null || request.tableName().isBlank() || request.tableName().length() > 64) {
            throw new ApiFailure(HttpStatus.BAD_REQUEST, "INVALID_DATASET_SOURCE", "Hãy chọn kết nối và bảng nguồn hợp lệ.");
        }
    }
}
