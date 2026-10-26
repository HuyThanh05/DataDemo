package com.datademo.backend.connections.service;
import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.common.ApiFailure;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
@Component
public class ConnectionValidator {
    public Input validate(Input i){
        if(i==null)throw invalid("Thiếu cấu hình.");
        String name=required(i.name(),100),host=required(i.host(),253),db=required(i.databaseName(),64),user=required(i.username(),100);
        if(!host.matches("[a-zA-Z0-9.-]+")||host.contains(".."))throw invalid("Host phải là tên máy hoặc địa chỉ IPv4, không gồm URL hay tham số.");
        if(!db.matches("[\\p{L}\\p{N}_$-]+"))throw invalid("Tên database không hợp lệ.");
        if(i.port()==null||i.port()<1||i.port()>65535)throw invalid("Port phải từ 1 đến 65535.");
        if(i.password()!=null&&i.password().length()>1000)throw invalid("Mật khẩu quá dài.");
        return new Input(name,host,i.port(),db,user,i.password()==null?"":i.password());
    }
    private String required(String s,int max){if(s==null||s.isBlank()||s.trim().length()>max)throw invalid("Tên, Host, database và tài khoản không được trống hoặc quá dài.");return s.trim();}
    private ApiFailure invalid(String m){return new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_CONNECTION",m);}
}
