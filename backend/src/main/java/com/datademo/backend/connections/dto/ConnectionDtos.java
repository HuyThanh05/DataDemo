package com.datademo.backend.connections.dto;
import java.util.List;
public final class ConnectionDtos {
    private ConnectionDtos() {}
    public record Input(String name,String host,Integer port,String databaseName,String username,String password) {}
    public record View(long id,String name,String host,int port,String databaseName,String username) {}
    public record Column(String name,String dataType,boolean nullable) {}
    public record TestResult(boolean success,String message,List<String> tables) {}
}
