package com.datademo.backend.dashboards;

import com.datademo.backend.charts.*;
import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.repository.DatasetRepository;
import com.datademo.backend.datasets.dto.DatasetDtos;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.datademo.backend.dashboards.DashboardDtos.*;

class DashboardFilterTests {
    final DashboardRepository dashboards=mock(DashboardRepository.class);
    final ChartRepository charts=mock(ChartRepository.class);
    final DatasetRepository datasets=mock(DatasetRepository.class);
    final ConnectionService connections=mock(ConnectionService.class);
    final ChartService chartService=mock(ChartService.class);
    final DashboardFilterService service=new DashboardFilterService(dashboards,charts,datasets,connections,chartService);
    final ChartDtos.Saved first=new ChartDtos.Saved(17,"A",new ChartDtos.Request(8L,"bar","score","COUNT","score","ASC",List.of(new ChartDtos.Filter("score","GTE","5"))));
    final ChartDtos.Saved other=new ChartDtos.Saved(18,"B",new ChartDtos.Request(9L,"bar","score","COUNT","score","ASC",List.of()));
    void setup() {
        when(dashboards.chartIds(91)).thenReturn(List.of(17L,18L));
        when(charts.get(17)).thenReturn(first);when(charts.get(18)).thenReturn(other);
        when(datasets.get(8)).thenReturn(new DatasetDtos.Detail(8,"Scores",1,"scores",List.of(new DatasetDtos.Column(1,"subject","Môn học","varchar(100)",false,true,false,true))));
        when(connections.columns(1,"scores")).thenReturn(List.of(new com.datademo.backend.connections.dto.ConnectionDtos.Column("subject","varchar(100)",false)));
    }
    @Test void scopesFilterToSameDatasetAndAllKeepsPrivateFilters() {
        setup();var selected=new CommonFilter(8L,"subject","Toán");when(dashboards.filter(91)).thenReturn(selected);
        service.preview(91,17);service.preview(91,18);
        verify(chartService).previewForDashboard(first,new ChartDtos.Filter("subject","EQ","Toán"));
        verify(chartService).previewForDashboard(other,null);
        when(dashboards.filter(91)).thenReturn(new CommonFilter(8L,"subject",null));
        service.preview(91,17);verify(chartService).previewForDashboard(first,null);
        assertEquals(List.of(new ChartDtos.Filter("score","GTE","5")),first.configuration().filters());
        assertThrows(ApiFailure.class,()->service.preview(91,999));
    }
    @Test void validatesScopeAndColumnsBeforePersisting() {
        setup();var selected=new CommonFilter(8L,"subject","Toán");when(dashboards.saveFilter(91,selected)).thenReturn(selected);
        assertEquals(selected,service.save(91,selected));
        assertThrows(ApiFailure.class,()->service.save(91,new CommonFilter(10L,"subject","Toán")));
        assertThrows(ApiFailure.class,()->service.save(91,new CommonFilter(8L,"not_allowed","Toán")));
        assertThrows(ApiFailure.class,()->service.save(91,new CommonFilter(8L,"subject"," ")));
        assertThrows(ApiFailure.class,()->service.save(91,new CommonFilter(null,"subject",null)));
        verify(dashboards,times(1)).saveFilter(anyLong(),any());
    }
}
