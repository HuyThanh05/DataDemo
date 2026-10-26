package com.datademo.backend;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.datasets.controller.DatasetController;
import com.datademo.backend.datasets.dto.PreviewRequest;
import com.datademo.backend.datasets.service.DatasetService;
import com.datademo.backend.datasource.TablePreview;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DatasetPreviewTests {
    private ConnectionService connections;
    private DatasetService service;
    private MockMvc mvc;
    @BeforeEach void setup() {
        connections = mock(ConnectionService.class);
        service = new DatasetService(connections, mock(com.datademo.backend.datasets.repository.DatasetRepository.class));
        mvc = MockMvcBuilders.standaloneSetup(new DatasetController(service)).build();
    }
    @Test void preservesNullAndZeroWithoutSavedDataset() throws Exception {
        when(connections.previewTable(7, "scores")).thenReturn(new TablePreview(
                List.of(new TablePreview.PreviewColumn("score", "DECIMAL")),
                Arrays.asList(Arrays.asList((Object) "0.00"), Arrays.asList((Object) null)), 100));
        mvc.perform(post("/api/datasets/preview").contentType(MediaType.APPLICATION_JSON)
                .content("{\"connectionId\":7,\"tableName\":\"scores\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.limit").value(100))
                .andExpect(jsonPath("$.columns[0].name").value("score"))
                .andExpect(jsonPath("$.rows[0][0]").value("0.00"))
                .andExpect(jsonPath("$.rows[1][0]").isEmpty());
    }
    @Test void missingSourceRejectedBeforeDatabaseAccess() {
        assertThrows(ApiFailure.class, () -> service.preview(new PreviewRequest(null, "scores")));
        assertThrows(ApiFailure.class, () -> service.preview(new PreviewRequest(-1L, "scores")));
        assertThrows(ApiFailure.class, () -> service.preview(new PreviewRequest(7L, " ")));
        verifyNoInteractions(connections);
    }
    @Test void unreadableTableReturnsSafeError() throws Exception {
        when(connections.previewTable(7, "not_allowed")).thenThrow(new ApiFailure(HttpStatus.BAD_REQUEST, "INVALID_TABLE", "Bảng không được phép đọc."));
        mvc.perform(post("/api/datasets/preview").contentType(MediaType.APPLICATION_JSON)
                .content("{\"connectionId\":7,\"tableName\":\"not_allowed\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_TABLE"));
    }
    @Test void malformedJsonReturns400() throws Exception {
        mvc.perform(post("/api/datasets/preview").contentType(MediaType.APPLICATION_JSON).content("{broken"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(connections);
    }
}

