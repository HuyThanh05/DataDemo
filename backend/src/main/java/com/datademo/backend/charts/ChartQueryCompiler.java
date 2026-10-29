package com.datademo.backend.charts;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.datasets.dto.DatasetDtos.Detail;
import com.datademo.backend.datasets.dto.DatasetDtos.Column;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import static com.datademo.backend.charts.ChartDtos.*;

@Component
public class ChartQueryCompiler {
    public Plan compile(Request input, Detail dataset) {
        return compile(input,dataset,10);
    }
    Plan compile(Request input, Detail dataset,int maxFilters) {
        if (input == null || input.datasetId() == null || input.datasetId() != dataset.id()
                || !Set.of("bar", "line", "pie", "table").contains(Objects.toString(input.chartType(), ""))
                || !Set.of("AVG", "COUNT", "COUNT_DISTINCT", "SUM", "MIN", "MAX").contains(Objects.toString(input.aggregation(), ""))
                || !Set.of("ASC", "DESC").contains(Objects.toString(input.sortDirection(), ""))) throw invalid();
        Column dimension = column(dataset, input.dimension());
        Column metric = column(dataset, input.metricColumn());
        if (!metric.allowedAggregations().contains(input.aggregation()) || !dimension.canGroup() || (!Set.of("COUNT","COUNT_DISTINCT").contains(input.aggregation()) && (!metric.canAggregate() || !numeric(metric.dataType())))) throw invalid();
        List<Filter> filters = input.filters() == null ? List.of() : input.filters();
        if (filters.size() > maxFilters) throw invalid();
        List<String> conditions = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        String d = quote(dimension.name());
        String expression = d;
        if (input.bucket() != null) {
            var b = input.bucket();
            if (!numeric(dimension.dataType()) || b.min() == null || b.max() == null || b.size() == null
                    || List.of(b.min(),b.max(),b.size()).stream().anyMatch(v -> v.precision() > 30 || Math.abs((long)v.scale()) > 10)
                    || b.size().signum() <= 0 || b.max().compareTo(b.min()) <= 0
                    || b.max().subtract(b.min()).remainder(b.size()).signum() != 0
                    || b.max().subtract(b.min()).divide(b.size()).compareTo(new BigDecimal("1000")) > 0) throw invalid();
            String decimal = "CAST(? AS DECIMAL(40,10))";
            expression = "CASE WHEN " + d + " = " + decimal + " THEN " + decimal + " ELSE " + decimal + " + FLOOR((" + d + " - " + decimal + ") / " + decimal + ") * " + decimal + " END";
            values.addAll(List.of(b.max(),b.max().subtract(b.size()),b.min(),b.min(),b.size(),b.size()));
            conditions.add(d + " >= ? AND " + d + " <= ?");
            values.addAll(List.of(b.min(),b.max()));
        }
        for (Filter filter : filters) {
            if (filter == null) throw invalid();
            Column c = column(dataset, filter.column());
            if (!c.canFilter()) throw invalid();
            String operator = Objects.toString(filter.operator(), "");
            if (operator.equals("IS_NULL") || operator.equals("IS_NOT_NULL")) {
                conditions.add(quote(c.name()) + (operator.equals("IS_NULL") ? " IS NULL" : " IS NOT NULL"));
                continue;
            }
            String sqlOperator = switch (operator) {
                case "EQ" -> "="; case "NE" -> "<>";
                case "GT" -> ">"; case "GTE" -> ">="; case "LT" -> "<"; case "LTE" -> "<=";
                default -> throw invalid();
            };
            if (!numeric(c.dataType()) && !Set.of("EQ", "NE").contains(operator)) throw invalid();
            if (filter.value() == null || filter.value().isBlank() || filter.value().length() > 500) throw invalid();
            Object value = filter.value();
            if (numeric(c.dataType())) {
                if (!filter.value().trim().matches("[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)")) throw invalid();
                value = new BigDecimal(filter.value().trim());
            }
            conditions.add(quote(c.name()) + " " + sqlOperator + " ?"); values.add(value);
        }
        String metricSql = input.aggregation().equals("COUNT_DISTINCT") ? "COUNT(DISTINCT " + quote(metric.name()) + ")" : input.aggregation() + "(" + quote(metric.name()) + ")";
        String sql = "SELECT " + expression + ", " + metricSql + " FROM " + quote(dataset.tableName())
                + (conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions))
                + " GROUP BY 1 ORDER BY 1 " + input.sortDirection() + " LIMIT 1001";
        return new Plan(sql, List.copyOf(values));
    }
    public static boolean numeric(String type) { return type.toLowerCase(Locale.ROOT).matches("^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)(\\b|\\().*"); }
    private Column column(Detail dataset, String name) { return dataset.columns().stream().filter(c -> c.name().equals(name)).findFirst().orElseThrow(ChartQueryCompiler::invalid); }
    private String quote(String name) { return "`" + name.replace("`", "``") + "`"; }
    public static ApiFailure invalid() { return new ApiFailure(HttpStatus.BAD_REQUEST, "INVALID_CHART", "Cấu hình biểu đồ hoặc bộ lọc không hợp lệ. Kiểm tra cột, kiểu dữ liệu và giá trị."); }
}
