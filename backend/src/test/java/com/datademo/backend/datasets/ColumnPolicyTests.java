package com.datademo.backend.datasets;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import com.datademo.backend.datasets.service.ColumnPolicy;
import com.datademo.backend.common.ApiFailure;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ColumnPolicyTests {
    final Column id=new Column(1,"customer_id","Mã khách","int",false,true,true,true);
    @Test void identifierCanOnlyCountEvenWhenStoredAsNumber() {
        var result=ColumnPolicy.apply(id,new ColumnSettings("IDENTIFIER",List.of("COUNT"),"COUNT"));
        assertEquals(List.of("COUNT"),result.allowedAggregations()); assertTrue(result.canGroup());
        assertThrows(ApiFailure.class,()->ColumnPolicy.apply(id,new ColumnSettings("IDENTIFIER",List.of("SUM"),"SUM")));
    }
    @Test void rejectsUnsupportedTypeUnknownRoleAndInvalidDefaults() {
        var text=new Column(2,"name","Name","varchar(100)",false,true,false,true);
        assertThrows(ApiFailure.class,()->ColumnPolicy.apply(text,new ColumnSettings("MEASURE",List.of("SUM"),"SUM")));
        assertThrows(ApiFailure.class,()->ColumnPolicy.apply(id,new ColumnSettings("MEASURE",List.of("COUNT"),"AVG")));
        assertThrows(ApiFailure.class,()->ColumnPolicy.apply(id,new ColumnSettings("UNKNOWN",List.of("COUNT"),"COUNT")));
        assertThrows(ApiFailure.class,()->ColumnPolicy.apply(id,new ColumnSettings("MEASURE",List.of("AVG","AVG"),"AVG")));
    }
    @Test void measureMayBeGroupedAndDimensionMayDisableAllAggregation() {
        assertTrue(ColumnPolicy.apply(id,new ColumnSettings("MEASURE",List.of("AVG","MIN"),"AVG")).canGroup());
        assertEquals(List.of("COUNT","COUNT_DISTINCT"),ColumnPolicy.apply(id,new ColumnSettings("DIMENSION",List.of(),null)).allowedAggregations());
    }
}
