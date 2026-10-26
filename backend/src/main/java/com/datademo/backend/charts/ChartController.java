package com.datademo.backend.charts;

import com.datademo.backend.common.ApiFailure;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/charts")
public class ChartController {
    private final ChartService service;
    public ChartController(ChartService service) { this.service = service; }
    @GetMapping public java.util.List<ChartDtos.Saved> list() { return service.list(); }
    @GetMapping("/{id}") public ChartDtos.Saved get(@PathVariable long id) { return service.get(id); }
    @PostMapping public ResponseEntity<ChartDtos.Saved> create(@RequestBody ChartDtos.Save input) { return ResponseEntity.status(201).body(service.save(null,input)); }
    @PatchMapping("/{id}") public ChartDtos.Saved update(@PathVariable long id,@RequestBody ChartDtos.Save input) { return service.save(id,input); }
    @GetMapping("/{id}/preview") public ChartDtos.Preview savedPreview(@PathVariable long id) { return service.preview(service.get(id).configuration()); }
    @PostMapping("/preview") public ChartDtos.Preview preview(@RequestBody ChartDtos.Request input) { return service.preview(input); }
    @ExceptionHandler(ApiFailure.class) public ResponseEntity<Map<String,String>> failure(ApiFailure e) { return ResponseEntity.status(e.status).body(Map.of("code", e.code, "message", e.getMessage())); }
    @ExceptionHandler(HttpMessageNotReadableException.class) public ResponseEntity<Map<String,String>> malformed() { return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Cấu hình biểu đồ không hợp lệ.")); }
    @ExceptionHandler(Exception.class) public ResponseEntity<Map<String,String>> unexpected() { return ResponseEntity.internalServerError().body(Map.of("code", "CHART_FAILED", "message", "Không thể tạo biểu đồ. Kiểm tra backend và nguồn dữ liệu.")); }
}
