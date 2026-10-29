package com.datademo.backend.datasets.service;

import com.datademo.backend.datasets.dto.DatasetDtos.*;
import com.datademo.backend.common.ApiFailure;
import java.util.*;
import org.springframework.http.HttpStatus;

public final class ColumnPolicy {
    private ColumnPolicy() {}
    public static boolean numeric(String type) {
        return type.toLowerCase(Locale.ROOT).matches("^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)(\\b|\\().*");
    }
    public static List<String> supported(String type) {
        return numeric(type)?List.of("COUNT","COUNT_DISTINCT","SUM","AVG","MIN","MAX"):List.of("COUNT","COUNT_DISTINCT");
    }
    public static Column apply(Column column, ColumnSettings settings) {
        if(settings!=null && "DIMENSION".equals(settings.role()))
            settings=new ColumnSettings("DIMENSION",List.of("COUNT","COUNT_DISTINCT"),"COUNT");
        if(settings==null || !Set.of("IDENTIFIER","DIMENSION","MEASURE").contains(Objects.toString(settings.role(),""))
            || settings.allowedAggregations()==null || new HashSet<>(settings.allowedAggregations()).size()!=settings.allowedAggregations().size()
            || !supported(column.dataType()).containsAll(settings.allowedAggregations())
            || (settings.defaultAggregation()!=null && !settings.allowedAggregations().contains(settings.defaultAggregation()))
            || (settings.allowedAggregations().isEmpty() && settings.defaultAggregation()!=null)
            || (settings.role().equals("IDENTIFIER") && settings.allowedAggregations().stream().anyMatch(a->!"COUNT".equals(a)))
            || (settings.role().equals("MEASURE") && !numeric(column.dataType()))) {
            throw new ApiFailure(HttpStatus.BAD_REQUEST,"INVALID_COLUMN_POLICY","Vai trò, phép tính cho phép hoặc mặc định không hợp lệ cho cột.");
        }
        return new Column(column.id(),column.name(),column.displayName(),column.dataType(),column.nullable(),column.canGroup(),column.canAggregate(),column.canFilter(),settings.role(),List.copyOf(settings.allowedAggregations()),settings.defaultAggregation());
    }
}
