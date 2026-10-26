package com.datademo.backend.dashboards;

import com.datademo.backend.common.ApiFailure;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import static com.datademo.backend.dashboards.DashboardDtos.*;

@RestController
@RequestMapping("/api/dashboards")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping public List<View> list() { return service.list(); }
    @GetMapping("/{id}") public View get(@PathVariable long id) { return service.get(id); }
    @PostMapping public ResponseEntity<View> create(@RequestBody Save input) { return ResponseEntity.status(201).body(service.save(null,input)); }
    @PatchMapping("/{id}") public View update(@PathVariable long id,@RequestBody Save input) { return service.save(id,input); }
    @GetMapping("/{id}/charts") public List<com.datademo.backend.charts.ChartDtos.Saved> charts(@PathVariable long id) { return service.charts(id); }
    @PostMapping("/{id}/charts") public List<com.datademo.backend.charts.ChartDtos.Saved> addChart(@PathVariable long id,@RequestBody AddChart input) { return service.addChart(id,input); }
    @DeleteMapping("/{id}/charts/{chartId}") public List<com.datademo.backend.charts.ChartDtos.Saved> removeChart(@PathVariable long id,@PathVariable long chartId) { return service.removeChart(id,chartId); }
    @GetMapping("/{id}/layout") public List<LayoutItem> layout(@PathVariable long id) { return service.layout(id); }
    @PutMapping("/{id}/layout") public List<LayoutItem> saveLayout(@PathVariable long id,@RequestBody LayoutSave input) { return service.saveLayout(id,input); }
    @ExceptionHandler(ApiFailure.class) public ResponseEntity<Map<String,String>> failure(ApiFailure e) { return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage())); }
    @ExceptionHandler(HttpMessageNotReadableException.class) public ResponseEntity<Map<String,String>> malformed() { return ResponseEntity.badRequest().body(Map.of("code","INVALID_REQUEST","message","Thông tin dashboard không hợp lệ.")); }
    @ExceptionHandler(Exception.class) public ResponseEntity<Map<String,String>> unexpected() { return ResponseEntity.internalServerError().body(Map.of("code","DASHBOARD_FAILED","message","Không xử lý được dashboard. Kiểm tra backend.")); }
}
