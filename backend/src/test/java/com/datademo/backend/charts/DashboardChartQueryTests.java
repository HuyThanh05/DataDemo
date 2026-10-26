package com.datademo.backend.charts;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.repository.DatasetRepository;
import com.datademo.backend.datasets.dto.DatasetDtos;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.datademo.backend.charts.ChartDtos.*;

class DashboardChartQueryTests {
    @Test void appendsCommonConditionToTenPrivateConditionsWithoutMutatingSavedConfig() {
        var datasets=mock(DatasetRepository.class);var connections=mock(ConnectionService.class);
        when(datasets.get(8)).thenReturn(new DatasetDtos.Detail(8,"Scores",1,"scores",List.of(new DatasetDtos.Column(1,"subject","Môn học","varchar",false,true,false,true),new DatasetDtos.Column(2,"score","Điểm","decimal",false,true,true,true))));
        when(connections.columns(1,"scores")).thenReturn(List.of(new com.datademo.backend.connections.dto.ConnectionDtos.Column("subject","varchar",false),new com.datademo.backend.connections.dto.ConnectionDtos.Column("score","decimal",false)));
        var service=new ChartService(datasets,connections,new ChartQueryCompiler(),mock(ChartRepository.class));
        var config=new Request(8L,"bar","subject","AVG","score","ASC",java.util.Collections.nCopies(10,new Filter("score","GTE","0")));
        service.previewForDashboard(new Saved(17,"A",config),new Filter("subject","EQ","Toán"));
        var plan=ArgumentCaptor.forClass(Plan.class);verify(connections).aggregate(eq(1L),eq("scores"),plan.capture());
        assertEquals(11,plan.getValue().parameters().size());assertEquals("Toán",plan.getValue().parameters().getLast());
        assertTrue(plan.getValue().sql().contains(" AND "));assertEquals(10,config.filters().size());
        var eleven=new java.util.ArrayList<>(config.filters());eleven.add(new Filter("subject","EQ","Toán"));
        assertThrows(ApiFailure.class,()->service.preview(new Request(8L,"bar","subject","AVG","score","ASC",eleven)));
    }
}
