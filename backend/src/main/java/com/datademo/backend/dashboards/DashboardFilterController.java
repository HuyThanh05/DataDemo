package com.datademo.backend.dashboards;

import com.datademo.backend.common.ApiFailure;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboards/{id}")
public class DashboardFilterController {
    private final DashboardFilterService service;
    public DashboardFilterController(DashboardFilterService service) { this.service=service; }
    @GetMapping("/filter") public DashboardDtos.CommonFilter get(@PathVariable long id) { return service.get(id); }
    @PutMapping("/filter") public DashboardDtos.CommonFilter save(@PathVariable long id,@RequestBody DashboardDtos.CommonFilter filter) { return service.save(id,filter); }
    @GetMapping("/filter-values") public com.datademo.backend.datasource.DistinctValues values(@PathVariable long id,@RequestParam long datasetId,@RequestParam String column) { return service.values(id,datasetId,column); }
    @GetMapping("/charts/{chartId}/preview") public com.datademo.backend.charts.ChartDtos.Preview preview(@PathVariable long id,@PathVariable long chartId) { return service.preview(id,chartId); }
    @ExceptionHandler(ApiFailure.class) public ResponseEntity<Map<String,String>> failure(ApiFailure e) { return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage())); }
    @ExceptionHandler(HttpMessageNotReadableException.class) public ResponseEntity<Map<String,String>> malformed() { return ResponseEntity.badRequest().body(Map.of("code","INVALID_REQUEST","message","Bộ lọc chung không hợp lệ.")); }
    @ExceptionHandler(Exception.class) public ResponseEntity<Map<String,String>> unexpected() { return ResponseEntity.internalServerError().body(Map.of("code","FILTER_FAILED","message","Không xử lý được bộ lọc dashboard. Kiểm tra backend và nguồn dữ liệu.")); }
}
