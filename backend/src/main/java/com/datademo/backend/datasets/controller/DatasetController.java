package com.datademo.backend.datasets.controller;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.datasets.dto.PreviewRequest;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import com.datademo.backend.datasets.service.DatasetService;
import com.datademo.backend.datasource.TablePreview;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/datasets")
public class DatasetController {
    private final DatasetService service;
    public DatasetController(DatasetService service) { this.service = service; }
    @GetMapping public List<Summary> list() { return service.list(); }
    @GetMapping("/{id}") public Detail get(@PathVariable long id) { return service.get(id); }
    @PostMapping public ResponseEntity<Detail> create(@RequestBody Create request) { return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request)); }
    @PatchMapping("/{id}") public Detail update(@PathVariable long id, @RequestBody Patch request) { return service.update(id, request); }
    @GetMapping("/{id}/preview") public TablePreview preview(@PathVariable long id) { return service.preview(id); }

    /** Preview an unsaved physical dataset; saved preview will use its stored definition later. */
    @PostMapping("/preview")
    public TablePreview preview(@RequestBody PreviewRequest request) { return service.preview(request); }

    @ExceptionHandler(ApiFailure.class)
    public ResponseEntity<Map<String, String>> failure(ApiFailure error) {
        return ResponseEntity.status(error.status).body(Map.of("code", error.code, "message", error.getMessage()));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> invalid() {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Thông tin nguồn dữ liệu không hợp lệ."));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> unexpected() {
        return ResponseEntity.internalServerError().body(Map.of("code", "INTERNAL_ERROR", "message", "Không thể xử lý dataset. Kiểm tra cấu hình backend."));
    }
}
