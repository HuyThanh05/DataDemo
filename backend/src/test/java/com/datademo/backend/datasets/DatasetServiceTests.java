package com.datademo.backend.datasets;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.dto.DatasetDtos.*;
import com.datademo.backend.datasets.repository.DatasetRepository;
import com.datademo.backend.datasets.service.DatasetService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DatasetServiceTests {
    private ConnectionService connections;
    private DatasetRepository repository;
    private DatasetService service;
    @BeforeEach void setup() {
        connections = mock(ConnectionService.class); repository = mock(DatasetRepository.class);
        service = new DatasetService(connections, repository);
        when(connections.columns(7, "scores")).thenReturn(List.of(
                new ConnectionDtos.Column("subject", "varchar(100)", false),
                new ConnectionDtos.Column("score", "decimal(4,2)", true)));
    }
    @Test void metadataAndCapabilitiesComeFromSourceNotFrontend() {
        service.create(new Create(" Demo ", 7L, "scores", Map.of("score", " Điểm thi ")));
        @SuppressWarnings("unchecked") ArgumentCaptor<List<Column>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).create(eq("Demo"), eq(7L), eq("scores"), captor.capture());
        var columns = captor.getValue();
        assertEquals("subject", columns.get(0).displayName());
        assertFalse(columns.get(0).canAggregate());
        assertEquals("Điểm thi", columns.get(1).displayName());
        assertTrue(columns.get(1).canAggregate());
        assertTrue(columns.get(1).nullable());
    }
    @Test void salesCapabilitiesFollowSqlTypesAndNotBusinessColumnNames() {
        when(connections.columns(19, "sales_records")).thenReturn(List.of(
                new ConnectionDtos.Column("product_name", "varchar(100)", false),
                new ConnectionDtos.Column("revenue", "decimal(15,2)", false),
                new ConnectionDtos.Column("quantity", "int", false),
                new ConnectionDtos.Column("sold_at", "date", false),
                new ConnectionDtos.Column("revenue_text", "varchar(100)", true)));
        service.create(new Create("Bán hàng", 19L, "sales_records", Map.of()));
        @SuppressWarnings("unchecked") ArgumentCaptor<List<Column>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).create(eq("Bán hàng"), eq(19L), eq("sales_records"), captor.capture());
        assertEquals(List.of(false, true, true, false, false), captor.getValue().stream().map(Column::canAggregate).toList());
        assertEquals(List.of("product_name", "revenue", "quantity", "sold_at", "revenue_text"), captor.getValue().stream().map(Column::name).toList());
    }
    @Test void invalidNameAndUnknownColumnsNeverPersist() {
        assertThrows(ApiFailure.class, () -> service.create(new Create(" ", 7L, "scores", Map.of())));
        assertThrows(ApiFailure.class, () -> service.create(new Create("Demo", 7L, "scores", Map.of("injected", "Name"))));
        verifyNoInteractions(repository);
    }
    @Test void patchOnlyRenamesExistingColumns() {
        when(repository.get(5)).thenReturn(new Detail(5,"Demo",7,"scores",List.of(new Column(9,"score","Điểm","decimal",false,true,true,true))));
        service.update(5, new Patch(null, Map.of("score", " ")));
        verify(repository).update(5,"Demo",Map.of("score","score"));
        verifyNoInteractions(connections);
    }
}
