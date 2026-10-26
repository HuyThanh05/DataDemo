package com.datademo.backend.persistence;

import com.datademo.backend.connections.repository.ConnectionRepository;
import com.datademo.backend.security.PasswordCipher;
import com.datademo.backend.charts.ChartRepository;
import com.datademo.backend.dashboards.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in prepare -> real-browser acceptance -> verify. Successful demo records are retained. */
@SpringBootTest
class Step10AcceptanceMySqlIT {
    @Autowired JdbcTemplate jdbc;
    @Autowired ConnectionRepository connections;
    @Autowired PasswordCipher cipher;
    @Autowired ChartRepository charts;
    @Autowired DashboardRepository dashboards;
    @Autowired DashboardFilterService filters;
    final JsonMapper json=JsonMapper.builder().build();
    final Path baseline=Path.of("target/step10-acceptance-baseline.json"),browser=Path.of("target/step10-acceptance-browser.json");
    final List<String> tables=List.of("database_connections","datasets","dataset_columns","charts","dashboards","dashboard_charts","dashboard_chart_layouts","dashboard_filters");
    Connection source() throws Exception {
        var view=connections.list().stream().filter(v->v.databaseName().equals("datademo_source") && v.username().equals("datademo_reader")).findFirst().orElseThrow();
        var props=new Properties();props.setProperty("user",view.username());props.setProperty("password",cipher.decrypt(connections.find(view.id()).encryptedPassword()));props.setProperty("connectTimeout","5000");props.setProperty("socketTimeout","10000");
        var c=DriverManager.getConnection("jdbc:mysql://"+view.host()+":"+view.port()+"/"+view.databaseName(),props);c.setReadOnly(true);return c;
    }
    Map<String,String> stats(Connection c) throws Exception {
        try(var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*),COUNT(DISTINCT candidate_id),SUM(score),MIN(score),MAX(score) FROM exam_scores")) {
            r.next();return Map.of("rows",r.getString(1),"candidates",r.getString(2),"sum",r.getString(3),"min",r.getString(4),"max",r.getString(5));
        }
    }
    List<Map<String,String>> expected(Connection c,String subject,boolean bucket) throws Exception {
        String d=bucket?"CASE WHEN score=10 THEN 9 ELSE FLOOR(score) END":"score";
        String sql="SELECT "+d+",COUNT(score) FROM exam_scores WHERE score IS NOT NULL"+(bucket?" AND score>=0 AND score<=10":"")+(subject==null?"":" AND subject_name=?")+" GROUP BY 1 ORDER BY 1";
        try(var p=c.prepareStatement(sql)) {
            if(subject!=null)p.setString(1,subject);p.setQueryTimeout(10);
            try(var r=p.executeQuery()) { var rows=new ArrayList<Map<String,String>>();while(r.next())rows.add(Map.of("dimension",r.getBigDecimal(1).stripTrailingZeros().toPlainString(),"value",r.getString(2)));return rows; }
        }
    }
    String hash(String table,String where) throws Exception {
        String order=switch(table) { case "dashboard_charts","dashboard_chart_layouts"->"dashboard_id,chart_id";case "dashboard_filters"->"dashboard_id";default->"id"; };
        var digest=java.security.MessageDigest.getInstance("SHA-256");
        for(var row:jdbc.queryForList("SELECT * FROM "+table+where+" ORDER BY "+order)) for(var entry:row.entrySet()) {
            byte[] bytes=(entry.getKey()+":"+(entry.getValue()==null?"<null>":entry.getValue().getClass().getName()+":"+entry.getValue())).getBytes(java.nio.charset.StandardCharsets.UTF_8);
            digest.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.length).array());digest.update(bytes);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
    @Test void acceptance() throws Exception {
        assertEquals("datademo_app",jdbc.queryForObject("SELECT DATABASE()",String.class));
        String phase=System.getProperty("datademo.acceptance.phase","prepare");
        if(phase.equals("prepare")) {
            var view=connections.list().stream().filter(v->v.databaseName().equals("datademo_source") && v.username().equals("datademo_reader")).findFirst().orElseThrow();
            var data=new LinkedHashMap<String,Object>();String prefix="NT10-"+UUID.randomUUID().toString().substring(0,8);
            data.put("prefix",prefix);data.put("connectionId",view.id());data.put("connectionName",view.name());
            data.put("datasetName",prefix+" - Điểm thi");data.put("rawName",prefix+" - Phổ điểm");data.put("bucketName",prefix+" - Số bài theo khoảng điểm");data.put("dashboardName",prefix+" - Dashboard nghiệm thu");
            var hashes=new LinkedHashMap<String,String>();for(String table:tables)hashes.put(table,hash(table,""));data.put("originalHashes",hashes);
            try(var c=source()) {
                data.put("sourceStats",stats(c));var subjects=new ArrayList<String>();
                try(var s=c.createStatement();var r=s.executeQuery("SELECT DISTINCT subject_name FROM exam_scores WHERE subject_name IS NOT NULL ORDER BY subject_name")) {while(r.next())subjects.add(r.getString(1));}
                assertTrue(subjects.size()>=2);String first=subjects.stream().filter(v->v.equalsIgnoreCase("Toán")).findFirst().orElse(subjects.getFirst());
                String second=subjects.stream().filter(v->v.equalsIgnoreCase("Ngữ văn") && !v.equals(first)).findFirst().orElseGet(()->subjects.stream().filter(v->!v.equals(first)).findFirst().orElseThrow());
                data.put("subjects",List.of(first,second));var scenarios=new ArrayList<Map<String,Object>>();
                for(String subject:new String[]{null,first,second}) {var scenario=new LinkedHashMap<String,Object>();scenario.put("subject",subject);scenario.put("raw",expected(c,subject,false));scenario.put("bucket",expected(c,subject,true));scenarios.add(scenario);}data.put("scenarios",scenarios);
            }
            Files.writeString(baseline,json.writeValueAsString(data));System.out.println("STEP10_BASELINE_READY "+prefix);return;
        }
        var data=json.readValue(Files.readString(baseline),Map.class);String prefix=(String)data.get("prefix");assertTrue(prefix.matches("NT10-[a-f0-9]{8}"));
        if(phase.equals("cleanup")) {
            var ds=jdbc.queryForList("SELECT id FROM datasets WHERE name=? AND connection_id=? AND table_name='exam_scores'",data.get("datasetName"),data.get("connectionId"));
            var boards=jdbc.queryForList("SELECT id FROM dashboards WHERE name=?",data.get("dashboardName"));
            for(var board:boards) {long id=((Number)board.get("id")).longValue();jdbc.update("DELETE FROM dashboard_charts WHERE dashboard_id=?",id);jdbc.update("DELETE FROM dashboards WHERE id=?",id);}
            for(var dataset:ds) {long id=((Number)dataset.get("id")).longValue();jdbc.update("DELETE FROM charts WHERE dataset_id=? AND name IN (?,?)",id,data.get("rawName"),data.get("bucketName"));jdbc.update("DELETE FROM dataset_columns WHERE dataset_id=?",id);jdbc.update("DELETE FROM datasets WHERE id=?",id);}return;
        }
        assertEquals("verify",phase);
        var result=json.readValue(Files.readString(browser),Map.class);assertEquals(prefix,result.get("prefix"));assertEquals(true,result.get("browserPassed"));
        long datasetId=((Number)result.get("datasetId")).longValue(),rawId=((Number)result.get("rawId")).longValue(),bucketId=((Number)result.get("bucketId")).longValue(),boardId=((Number)result.get("dashboardId")).longValue();
        assertEquals(data.get("dashboardName"),dashboards.get(boardId).name());assertEquals(Set.of(rawId,bucketId),new HashSet<>(dashboards.chartIds(boardId)));
        assertEquals("bar",charts.get(rawId).configuration().chartType());assertEquals("line",charts.get(bucketId).configuration().chartType());
        assertEquals(datasetId,charts.get(rawId).configuration().datasetId());assertEquals(datasetId,charts.get(bucketId).configuration().datasetId());
        assertTrue(charts.get(rawId).configuration().filters().isEmpty());assertTrue(charts.get(bucketId).configuration().filters().isEmpty());
        assertEquals(0,charts.get(bucketId).configuration().bucket().max().compareTo(java.math.BigDecimal.TEN));
        var selected=dashboards.filter(boardId);assertEquals(datasetId,selected.datasetId());assertEquals("subject_name",selected.column());assertEquals(((List<?>)data.get("subjects")).getFirst(),selected.value());
        try(var c=source()) {
            assertEquals(data.get("sourceStats"),stats(c));
            for(long id:new long[]{rawId,bucketId}) {
                var actual=filters.preview(boardId,id);var expected=expected(c,selected.value(),id==bucketId);assertFalse(actual.truncated());assertEquals(expected.size(),actual.rows().size());
                for(int i=0;i<expected.size();i++) {assertEquals(expected.get(i).get("dimension"),new java.math.BigDecimal(actual.rows().get(i).dimension().toString()).stripTrailingZeros().toPlainString());assertEquals(expected.get(i).get("value"),actual.rows().get(i).value());}
            }
        }
        for(String table:tables) {
            String where=switch(table) {
                case "datasets"->" WHERE id<>"+datasetId;case "dataset_columns"->" WHERE dataset_id<>"+datasetId;case "charts"->" WHERE id NOT IN ("+rawId+","+bucketId+")";case "dashboards"->" WHERE id<>"+boardId;
                case "dashboard_charts","dashboard_chart_layouts","dashboard_filters"->" WHERE dashboard_id<>"+boardId;default->"";};
            assertEquals(((Map<?,?>)data.get("originalHashes")).get(table),hash(table,where),"Existing rows changed in "+table);
        }
        result.put("mysqlVerified",true);Files.writeString(Path.of("target/step10-acceptance-verified.json"),json.writeValueAsString(result));
        System.out.println("STEP10_ACCEPTED dashboardId="+boardId+" rawChartId="+rawId+" bucketChartId="+bucketId);
    }
}
