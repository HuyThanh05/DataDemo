package com.datademo.backend.datasource;
import java.sql.*;
import java.util.*;
import com.datademo.backend.connections.dto.ConnectionDtos.*;
import com.datademo.backend.common.ApiFailure;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
@Component
public class SourceDatabaseClient {
    public DistinctValues distinctValues(Input input,String table,String column) {
        if(columns(input,table).stream().noneMatch(c->c.name().equals(column))) throw new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_COLUMN","Cột lọc không còn tồn tại trong nguồn.");
        String t="`"+table.replace("`","``")+"`",c="`"+column.replace("`","``")+"`";
        try(Connection connection=source(input);Statement statement=connection.createStatement()) {
            statement.setQueryTimeout(10);statement.setMaxRows(1001);
            try(ResultSet r=statement.executeQuery("SELECT DISTINCT "+c+" FROM "+t+" WHERE "+c+" IS NOT NULL ORDER BY "+c+" LIMIT 1001")) {
                List<String> values=new ArrayList<>();boolean truncated=false;int count=0;
                while(r.next()) {
                    if(++count>1000) { truncated=true;break; }
                    String value=r.getString(1);
                    if(value.isBlank() || value.length()>500) { truncated=true;continue; }
                    values.add(value);
                }
                return new DistinctValues(values,truncated);
            }
        } catch(SQLException e) { throw sourceError(e); }
    }
    public com.datademo.backend.charts.ChartDtos.Preview aggregate(Input input, String table, com.datademo.backend.charts.ChartDtos.Plan plan) {
        long start = System.nanoTime();
        try (Connection connection = source(input)) {
            if (!readableTables(connection, input.databaseName()).contains(table)) throw new ApiFailure(HttpStatus.BAD_REQUEST, "INVALID_TABLE", "Bảng không tồn tại hoặc không được phép đọc.");
            try (PreparedStatement statement = connection.prepareStatement(plan.sql())) {
                statement.setQueryTimeout(10); statement.setMaxRows(1001);
                for (int i = 0; i < plan.parameters().size(); i++) statement.setObject(i + 1, plan.parameters().get(i));
                try (ResultSet result = statement.executeQuery()) {
                    var rows = new ArrayList<com.datademo.backend.charts.ChartDtos.Row>();
                    boolean truncated = false;
                    while (result.next()) {
                        if (rows.size() == 1000) { truncated = true; break; }
                        rows.add(new com.datademo.backend.charts.ChartDtos.Row(previewValue(result.getObject(1)), result.getString(2)));
                    }
                    return new com.datademo.backend.charts.ChartDtos.Preview(rows, truncated, 1000, (System.nanoTime() - start) / 1_000_000);
                }
            }
        } catch (SQLException e) {
            if (e instanceof SQLTimeoutException || e.getErrorCode() == 3024) throw new ApiFailure(HttpStatus.GATEWAY_TIMEOUT, "SOURCE_TIMEOUT", "Truy vấn biểu đồ vượt quá thời gian cho phép.");
            throw new ApiFailure(HttpStatus.BAD_GATEWAY, "CHART_QUERY_FAILED", "Không truy vấn được biểu đồ. Kiểm tra nguồn, quyền đọc và cấu trúc cột.");
        }
    }
    public TablePreview preview(Input input, String table) {
        try (Connection connection = source(input)) {
            if (!readableTables(connection, input.databaseName()).contains(table)) {
                throw new ApiFailure(HttpStatus.BAD_REQUEST, "INVALID_TABLE", "Bảng không tồn tại hoặc không được phép đọc.");
            }
            // Identifiers cannot be JDBC parameters: verify metadata membership, then quote.
            String identifier = "`" + table.replace("`", "``") + "`";
            try (Statement statement = connection.createStatement()) {
                statement.setQueryTimeout(10);
                statement.setMaxRows(100);
                try (ResultSet result = statement.executeQuery("SELECT * FROM " + identifier + " LIMIT 100")) {
                    ResultSetMetaData metadata = result.getMetaData();
                    List<TablePreview.PreviewColumn> columns = new ArrayList<>();
                    for (int i = 1; i <= metadata.getColumnCount(); i++) {
                        columns.add(new TablePreview.PreviewColumn(metadata.getColumnLabel(i), metadata.getColumnTypeName(i)));
                    }
                    List<List<Object>> rows = new ArrayList<>();
                    while (result.next() && rows.size() < 100) {
                        List<Object> row = new ArrayList<>();
                        for (int i = 1; i <= columns.size(); i++) row.add(previewValue(result.getObject(i)));
                        rows.add(row);
                    }
                    return new TablePreview(columns, rows, 100);
                }
            }
        } catch (SQLException exception) { throw sourceError(exception); }
    }

    private Object previewValue(Object value) throws SQLException {
        if (value == null || value instanceof Boolean) return value;
        // Strings preserve decimal scale and large integer precision in JavaScript.
        if (value instanceof java.math.BigDecimal decimal) return decimal.toPlainString();
        if (value instanceof Long || value instanceof java.math.BigInteger) return value.toString();
        if (value instanceof Number) return value;
        if (value instanceof byte[] bytes) return "[Nhị phân: " + bytes.length + " byte]";
        if (value instanceof Blob blob) return "[Nhị phân: " + blob.length() + " byte]";
        if (value instanceof Clob clob) {
            long length = clob.length();
            return clob.getSubString(1, (int) Math.min(length, 2000)) + (length > 2000 ? "…" : "");
        }
        String text = value.toString();
        return text.length() > 2000 ? text.substring(0, 2000) + "…" : text;
    }
    private ApiFailure sourceError(SQLException e){
        if(e instanceof SQLTimeoutException || e.getMessage()!=null&&e.getMessage().contains("timed out"))return new ApiFailure(HttpStatus.GATEWAY_TIMEOUT,"SOURCE_TIMEOUT","MySQL nguồn phản hồi quá thời gian.");
        if(e.getErrorCode()==1045||e.getErrorCode()==1044)return new ApiFailure(HttpStatus.BAD_GATEWAY,"SOURCE_ACCESS_DENIED","MySQL từ chối truy cập. Kiểm tra tài khoản, mật khẩu và quyền đọc nguồn.");
        return new ApiFailure(HttpStatus.BAD_GATEWAY,"SOURCE_CONNECTION_FAILED","Không kết nối được MySQL nguồn. Kiểm tra server, Host, Port và tên database.");
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
    public TestResult test(Input raw){Input i=raw;try(Connection c=source(i)){List<String> tables=readableTables(c,i.databaseName());return new TestResult(true,"Kết nối thành công. Tìm thấy "+tables.size()+" bảng được phép đọc.",tables);}catch(SQLException e){throw sourceError(e);}}
    public List<String> tables(Input i){try(Connection c=source(i)){return readableTables(c,i.databaseName());}catch(SQLException e){throw sourceError(e);}}
    public List<Column> columns(Input i,String table){try(Connection c=source(i)){
        if(!readableTables(c,i.databaseName()).contains(table))throw new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_CONNECTION","Bảng không tồn tại hoặc không được phép đọc.");
        try(PreparedStatement p=c.prepareStatement("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION")){
            p.setString(1,i.databaseName());p.setString(2,table);p.setQueryTimeout(10);try(ResultSet r=p.executeQuery()){List<Column> cols=new ArrayList<>();while(r.next())cols.add(new Column(r.getString(1),r.getString(2),"YES".equals(r.getString(3))));return cols;}
        }
    }catch(SQLException e){throw sourceError(e);}}
}
