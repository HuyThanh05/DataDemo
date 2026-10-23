package com.datademo.backend.connection;

import java.sql.*;
import java.util.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ConnectionManager {
    public record Input(String name,String host,Integer port,String databaseName,String username,String password) {}
    public record View(long id,String name,String host,int port,String databaseName,String username) {}
    public record Column(String name,String dataType,boolean nullable) {}
    public record TestResult(boolean success,String message,List<String> tables) {}
    public static class Failure extends RuntimeException {
        public final HttpStatus status; public final String code;
        public Failure(HttpStatus status,String code,String message){super(message);this.status=status;this.code=code;}
    }
    private final String appUrl,appUser,appPassword;
    private final Path keyPath;
    public ConnectionManager(@Value("${datademo.app.url}") String url,@Value("${datademo.app.username}") String user,
                             @Value("${datademo.app.password}") String password,@Value("${datademo.key-file}") String key){
        appUrl=url;appUser=user;appPassword=password;keyPath=Path.of(key);
    }
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
    private Failure invalid(String m){return new Failure(HttpStatus.BAD_REQUEST,"INVALID_CONNECTION",m);}
    private Failure appError(){return new Failure(HttpStatus.SERVICE_UNAVAILABLE,"APP_DATABASE_UNAVAILABLE","Chưa truy cập được datademo_app. Cấu hình tài khoản ghi trong backend/application-local.properties theo docs/step-7.md.");}
    private Failure sourceError(SQLException e){
        if(e instanceof SQLTimeoutException || e.getMessage()!=null&&e.getMessage().contains("timed out"))return new Failure(HttpStatus.GATEWAY_TIMEOUT,"SOURCE_TIMEOUT","MySQL nguồn phản hồi quá thời gian.");
        if(e.getErrorCode()==1045||e.getErrorCode()==1044)return new Failure(HttpStatus.BAD_GATEWAY,"SOURCE_ACCESS_DENIED","MySQL từ chối truy cập. Kiểm tra tài khoản, mật khẩu và quyền đọc nguồn.");
        return new Failure(HttpStatus.BAD_GATEWAY,"SOURCE_CONNECTION_FAILED","Không kết nối được MySQL nguồn. Kiểm tra server, Host, Port và tên database.");
    }
    private Connection source(Input i)throws SQLException{
        Properties p=new Properties();p.setProperty("user",i.username());p.setProperty("password",i.password());p.setProperty("connectTimeout","5000");p.setProperty("socketTimeout","10000");p.setProperty("allowMultiQueries","false");p.setProperty("allowLoadLocalInfile","false");
        Connection c=DriverManager.getConnection("jdbc:mysql://"+i.host()+":"+i.port()+"/"+i.databaseName(),p);
        try{c.setReadOnly(true);return c;}catch(SQLException e){c.close();throw e;}
    }
    private List<String> readableTables(Connection c,String db)throws SQLException{
        List<String> names=new ArrayList<>();
        try(PreparedStatement p=c.prepareStatement("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")){
            p.setString(1,db);p.setQueryTimeout(10);try(ResultSet r=p.executeQuery()){while(r.next())names.add(r.getString(1));}
        }
        List<String> readable=new ArrayList<>();
        for(String table:names){try(Statement s=c.createStatement()){s.setQueryTimeout(10);try(ResultSet ignored=s.executeQuery("SELECT * FROM `"+table.replace("`","``")+"` LIMIT 0")){readable.add(table);}}catch(SQLException e){if(e.getErrorCode()!=1142&&e.getErrorCode()!=1143)throw e;}}
        return readable;
    }
    public TestResult test(Input raw){Input i=validate(raw);try(Connection c=source(i)){List<String> tables=readableTables(c,i.databaseName());return new TestResult(true,"Kết nối thành công. Tìm thấy "+tables.size()+" bảng được phép đọc.",tables);}catch(SQLException e){throw sourceError(e);}}
    public TestResult test(long id){return test(storedInput(id));}
    public List<String> tables(long id){Input i=storedInput(id);try(Connection c=source(i)){return readableTables(c,i.databaseName());}catch(SQLException e){throw sourceError(e);}}
    public List<Column> columns(long id,String table){Input i=storedInput(id);try(Connection c=source(i)){
        if(!readableTables(c,i.databaseName()).contains(table))throw invalid("Bảng không tồn tại hoặc không được phép đọc.");
        try(PreparedStatement p=c.prepareStatement("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION")){
            p.setString(1,i.databaseName());p.setString(2,table);p.setQueryTimeout(10);try(ResultSet r=p.executeQuery()){List<Column> cols=new ArrayList<>();while(r.next())cols.add(new Column(r.getString(1),r.getString(2),"YES".equals(r.getString(3))));return cols;}
        }
    }catch(SQLException e){throw sourceError(e);}}
    private Connection app()throws SQLException{
        Connection c=DriverManager.getConnection(appUrl,appUser,appPassword);
        try(Statement s=c.createStatement()){s.setQueryTimeout(10);s.executeUpdate("""
            CREATE TABLE IF NOT EXISTS database_connections (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL, host VARCHAR(253) NOT NULL, port INT NOT NULL,
                database_name VARCHAR(64) NOT NULL, username VARCHAR(100) NOT NULL,
                encrypted_password TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);return c;}catch(SQLException e){c.close();throw e;}
    }
    private View view(ResultSet r)throws SQLException{return new View(r.getLong("id"),r.getString("name"),r.getString("host"),r.getInt("port"),r.getString("database_name"),r.getString("username"));}
    public List<View> list(){try(Connection c=app();PreparedStatement p=c.prepareStatement("SELECT id,name,host,port,database_name,username FROM database_connections ORDER BY id DESC")){p.setQueryTimeout(10);try(ResultSet r=p.executeQuery()){List<View> result=new ArrayList<>();while(r.next())result.add(view(r));return result;}}catch(SQLException e){throw appError();}}
    public View get(long id){try(Connection c=app();PreparedStatement p=c.prepareStatement("SELECT id,name,host,port,database_name,username FROM database_connections WHERE id=?")){p.setLong(1,id);p.setQueryTimeout(10);try(ResultSet r=p.executeQuery()){if(!r.next())throw missing();return view(r);}}catch(SQLException e){throw appError();}}
    private Input storedInput(long id){try(Connection c=app();PreparedStatement p=c.prepareStatement("SELECT * FROM database_connections WHERE id=?")){p.setLong(1,id);p.setQueryTimeout(10);try(ResultSet r=p.executeQuery()){if(!r.next())throw missing();View v=view(r);return new Input(v.name(),v.host(),v.port(),v.databaseName(),v.username(),decrypt(r.getString("encrypted_password")));}}catch(SQLException e){throw appError();}}
    private Failure missing(){return new Failure(HttpStatus.NOT_FOUND,"CONNECTION_NOT_FOUND","Không tìm thấy kết nối.");}
    public View save(Input raw){Input i=validate(raw);test(i);String secret=encrypt(i.password());try(Connection c=app();PreparedStatement p=c.prepareStatement("INSERT INTO database_connections(name,host,port,database_name,username,encrypted_password) VALUES(?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS)){
        p.setString(1,i.name());p.setString(2,i.host());p.setInt(3,i.port());p.setString(4,i.databaseName());p.setString(5,i.username());p.setString(6,secret);p.setQueryTimeout(10);p.executeUpdate();try(ResultSet r=p.getGeneratedKeys()){if(!r.next())throw new SQLException();return new View(r.getLong(1),i.name(),i.host(),i.port(),i.databaseName(),i.username());}
    }catch(SQLException e){throw appError();}}
    private synchronized byte[] key(boolean create)throws Exception{
        if(!Files.exists(keyPath)&&create){Files.createDirectories(keyPath.toAbsolutePath().getParent());byte[] value=new byte[32];new SecureRandom().nextBytes(value);try{Files.write(keyPath,value,StandardOpenOption.CREATE_NEW);}catch(FileAlreadyExistsException ignored){}}
        byte[] value=Files.readAllBytes(keyPath);if(value.length!=32)throw new IllegalStateException();return value;
    }
    String encrypt(String value){try{byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(true),"AES"),new GCMParameterSpec(128,iv));return Base64.getEncoder().encodeToString(iv)+":"+Base64.getEncoder().encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw cipherError();}}
    String decrypt(String value){try{String[] parts=value.split(":",2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key(false),"AES"),new GCMParameterSpec(128,Base64.getDecoder().decode(parts[0])));return new String(c.doFinal(Base64.getDecoder().decode(parts[1])),StandardCharsets.UTF_8);}catch(Exception e){throw cipherError();}}
    private Failure cipherError(){return new Failure(HttpStatus.INTERNAL_SERVER_ERROR,"ENCRYPTION_ERROR","Không đọc được khóa mã hóa cục bộ. Giữ nguyên backend/.local/connection.key để mở các kết nối đã lưu.");}
}
