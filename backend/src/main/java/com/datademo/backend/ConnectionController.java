package com.datademo.backend;

import com.datademo.backend.connection.ConnectionManager;
import com.datademo.backend.connection.ConnectionManager.*;
import java.util.List;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestController
@RequestMapping("/api/connections")
public class ConnectionController {
    private final ConnectionManager manager;
    public ConnectionController(ConnectionManager manager) { this.manager=manager; }
    @GetMapping public List<View> list(){return manager.list();}
    @GetMapping("/{id}") public View get(@PathVariable long id){return manager.get(id);}
    @PostMapping public ResponseEntity<View> save(@RequestBody Input input){return ResponseEntity.status(HttpStatus.CREATED).body(manager.save(input));}
    @PostMapping("/test") public TestResult test(@RequestBody Input input){return manager.test(input);}
    @PostMapping("/{id}/test") public TestResult test(@PathVariable long id){return manager.test(id);}
    @GetMapping("/{id}/tables") public List<String> tables(@PathVariable long id){return manager.tables(id);}
    @GetMapping("/{id}/columns") public List<Column> columns(@PathVariable long id,@RequestParam String table){return manager.columns(id,table);}
    @ExceptionHandler(Failure.class) public ResponseEntity<Map<String,String>> failure(Failure e){return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage()));}
    @ExceptionHandler(HttpMessageNotReadableException.class) public ResponseEntity<Map<String,String>> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_REQUEST","message","Invalid request body."));}
    @ExceptionHandler(Exception.class) public ResponseEntity<Map<String,String>> unexpected(){return ResponseEntity.internalServerError().body(Map.of("code","INTERNAL_ERROR","message","Unable to process request. Check backend configuration."));}
}
