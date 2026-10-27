package com.datademo.backend.charts;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import java.sql.DriverManager;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static com.datademo.backend.charts.ChartDtos.*;

class ChartQueryCompilerTests {
    @Test void aggregatesSalesColumnsAndUsesTheRequestedMonetaryBuckets() throws Exception {
        var sales = new Detail(903, "Bán hàng", 19, "sales_records", List.of(
                new Column(1, "product_name", "Sản phẩm", "varchar(100)", false, true, false, true),
                new Column(2, "revenue", "Doanh thu", "decimal(15,2)", true, true, true, true),
                new Column(3, "quantity", "Số lượng", "int", false, true, true, true)));
        var filters = List.of(new Filter("quantity", "GTE", "1"));
        var average = compiler.compile(new Request(903L, "bar", "product_name", "AVG", "revenue", "ASC", filters), sales);
        var bucket = compiler.compile(new Request(903L, "bar", "revenue", "COUNT", "revenue", "ASC", filters,
                new Bucket(java.math.BigDecimal.ZERO, new java.math.BigDecimal("1000000"), new java.math.BigDecimal("100000"))), sales);
        try (var c = DriverManager.getConnection("jdbc:h2:mem:sales-audit;MODE=MySQL"); var s = c.createStatement()) {
            s.execute("CREATE TABLE sales_records(product_name VARCHAR(100),revenue DECIMAL(15,2),quantity INT)");
            s.execute("INSERT INTO sales_records VALUES('Áo',100000,1),('Áo',200000,2),('Quần',300000,1),('Quần',NULL,0)");
            try (var p = c.prepareStatement(average.sql())) {
                for (int i = 0; i < average.parameters().size(); i++) p.setObject(i + 1, average.parameters().get(i));
                var totals = new HashMap<String, java.math.BigDecimal>();
                try (var r = p.executeQuery()) { while (r.next()) totals.put(r.getString(1), r.getBigDecimal(2)); }
                assertEquals(0, totals.get("Áo").compareTo(new java.math.BigDecimal("150000")));
                assertEquals(0, totals.get("Quần").compareTo(new java.math.BigDecimal("300000")));
            }
            try (var p = c.prepareStatement(bucket.sql())) {
                for (int i = 0; i < bucket.parameters().size(); i++) p.setObject(i + 1, bucket.parameters().get(i));
                try (var r = p.executeQuery()) {
                    for (int value : List.of(100000, 200000, 300000)) { assertTrue(r.next()); assertEquals(value, r.getInt(1)); assertEquals(1, r.getInt(2)); }
                    assertFalse(r.next());
                }
            }
        }
    }

    @Test void pieAndTableUseTheSameValidatedAggregationQuery() {
        var base = request("COUNT", "score", "DESC", List.of(new Filter("category", "EQ", "Toán")));
        var expected = compiler.compile(base, dataset);
        for (String type : List.of("bar", "line", "pie", "table")) {
            var input = new Request(base.datasetId(), type, base.dimension(), base.aggregation(), base.metricColumn(), base.sortDirection(), base.filters());
            assertEquals(expected, compiler.compile(input, dataset));
        }
        assertThrows(ApiFailure.class, () -> compiler.compile(new Request(1L, "scatter", "category", "COUNT", "score", "ASC", List.of()), dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(new Request(1L, "pie", "category", "AVG", "category", "ASC", List.of()), dataset));
    }

    @Test void bucketsIncludeTenInLastIntervalAndExcludeNullAndOutOfRange() throws Exception {
        var request = new Request(1L,"line","score","COUNT","score","ASC",List.of(),
                new Bucket(new java.math.BigDecimal("0"),new java.math.BigDecimal("10"),java.math.BigDecimal.ONE));
        var plan = compiler.compile(request,dataset);
        try (var c = DriverManager.getConnection("jdbc:h2:mem:chart-buckets;MODE=MySQL")) {
            try (var s = c.createStatement()) {
                s.execute("CREATE TABLE samples(category VARCHAR(100),score DECIMAL(4,2))");
                s.execute("INSERT INTO samples(score) VALUES(-1),(0),(0.99),(1),(9.99),(10),(11),(NULL)");
            }
            try (var p = c.prepareStatement(plan.sql())) {
                for (int i=0;i<plan.parameters().size();i++) p.setObject(i+1,plan.parameters().get(i));
                try (var r = p.executeQuery()) {
                    assertTrue(r.next());assertEquals(0,r.getInt(1));assertEquals(2,r.getInt(2));
                    assertTrue(r.next());assertEquals(1,r.getInt(1));assertEquals(1,r.getInt(2));
                    assertTrue(r.next());assertEquals(9,r.getInt(1));assertEquals(2,r.getInt(2));assertFalse(r.next());
                }
            }
        }
        assertThrows(ApiFailure.class, () -> compiler.compile(new Request(1L,"line","category","COUNT","score","ASC",List.of(),request.bucket()),dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(new Request(1L,"line","score","COUNT","score","ASC",List.of(),new Bucket(java.math.BigDecimal.ZERO,java.math.BigDecimal.TEN,new java.math.BigDecimal("3"))),dataset));
    }
    private final ChartQueryCompiler compiler = new ChartQueryCompiler();
    private final Detail dataset = new Detail(1, "Example", 2, "samples", List.of(
            new Column(1,"category","Nhóm","varchar(100)",true,true,false,true),
            new Column(2,"score","Điểm","decimal(4,2)",true,true,true,true)));
    private Request request(String aggregate, String metric, String sort, List<Filter> filters) { return new Request(1L,"bar","category",aggregate,metric,sort,filters); }

    @Test void rejectsInvalidIdentifiersOperatorsTypesAndSort() {
        assertThrows(ApiFailure.class, () -> compiler.compile(request("AVG","category","ASC",List.of()), dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(request("COUNT","score`; DROP TABLE samples","ASC",List.of()), dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(request("COUNT","score","DESC; SELECT 1",List.of()), dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(request("COUNT","score","ASC",List.of(new Filter("category","GT","1"))), dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(request("AVG","score","ASC",List.of(new Filter("score","EQ","NaN"))), dataset));
        assertThrows(ApiFailure.class, () -> compiler.compile(request("AVG","score","ASC",Collections.nCopies(11,new Filter("score","EQ","0"))), dataset));
    }
    @Test void bindsFilterTextInsteadOfInjectingItIntoSql() {
        String attack = "' OR 1=1 --";
        var plan = compiler.compile(request("COUNT","score","ASC",List.of(new Filter("category","EQ",attack))), dataset);
        assertFalse(plan.sql().contains(attack)); assertEquals(List.of(attack),plan.parameters());
    }
    @Test void aggregatesAllRowsWithNullZeroAndNumericOrdering() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:chart-compiler;MODE=MySQL")) {
            try (var s = connection.createStatement()) {
                s.execute("CREATE TABLE samples(category VARCHAR(100),score DECIMAL(4,2))");
                s.execute("INSERT INTO samples VALUES('A',0),('A',10),('A',NULL),('B',NULL)");
                // AVG ignores NULL, includes zero; DESC ordering is evaluated in the database.
                var plan = compiler.compile(request("AVG","score","DESC",List.of()), dataset);
                try (var r = s.executeQuery(plan.sql())) {
                    assertTrue(r.next()); assertEquals("B",r.getString(1)); assertNull(r.getString(2));
                    assertTrue(r.next()); assertEquals("A",r.getString(1)); assertEquals(0,new java.math.BigDecimal("5").compareTo(r.getBigDecimal(2)));
                }
                plan = compiler.compile(request("COUNT","score","ASC",List.of(new Filter("score","GTE","0"), new Filter("category","NE","B"))), dataset);
                try (var p = connection.prepareStatement(plan.sql())) {
                    for (int i = 0; i < plan.parameters().size(); i++) p.setObject(i + 1, plan.parameters().get(i));
                    try (var r = p.executeQuery()) { assertTrue(r.next()); assertEquals("A",r.getString(1)); assertEquals(2,r.getInt(2)); assertFalse(r.next()); }
                }
                plan = compiler.compile(request("COUNT","category","ASC",List.of(new Filter("score","IS_NULL",null))), dataset);
                try (var r = s.executeQuery(plan.sql())) { assertTrue(r.next()); assertEquals(1,r.getInt(2)); assertTrue(r.next()); assertEquals(1,r.getInt(2)); }
                plan = compiler.compile(new Request(1L,"line","score","COUNT","score","ASC",List.of(new Filter("score","IS_NOT_NULL",null))), dataset);
                try (var r = s.executeQuery(plan.sql())) { assertTrue(r.next()); assertEquals(0,r.getInt(1)); assertTrue(r.next()); assertEquals(10,r.getInt(1)); assertFalse(r.next()); }
            }
        }
    }
}
