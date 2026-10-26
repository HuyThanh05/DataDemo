package com.datademo.backend.common;
import org.springframework.http.HttpStatus;
public class ApiFailure extends RuntimeException {
    public final HttpStatus status;
    public final String code;
    public ApiFailure(HttpStatus status,String code,String message) { super(message); this.status=status; this.code=code; }
}
