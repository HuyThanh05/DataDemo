package com.datademo.backend;

import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.connections.controller.ConnectionController;
import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

/** HTTP contracts for refactoring; source/database behavior is not mocked proof of MySQL correctness. */
class ConnectionApiContractTests {
    private ConnectionService manager;
    private MockMvc mvc;
    private final View saved = new View(7,"Nguồn mẫu","localhost",3306,"source_db","reader");
    private static final String INPUT = """
        {"name":"Nguồn mẫu","host":"localhost","port":3306,
         "databaseName":"source_db","username":"reader","password":"test-only-secret"}
        """;

    @BeforeEach void setup() {
        manager=mock(ConnectionService.class);
        mvc=MockMvcBuilders.standaloneSetup(new ConnectionController(manager),new HealthController()).build();
    }
    @Test void healthRemainsAvailable() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk())
            .andExpect(content().string("DataDemo backend is running"));
    }
    @Test void listOmitsPassword() throws Exception {
        when(manager.list()).thenReturn(List.of(saved));
        mvc.perform(get("/api/connections")).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(7))
            .andExpect(jsonPath("$[0].databaseName").value("source_db"))
            .andExpect(jsonPath("$[0].password").doesNotExist())
            .andExpect(jsonPath("$[0].encryptedPassword").doesNotExist());
    }
    @Test void emptyListIsNotAnError() throws Exception {
        when(manager.list()).thenReturn(List.of());
        mvc.perform(get("/api/connections")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }
    @Test void detailOmitsPassword() throws Exception {
        when(manager.get(7)).thenReturn(saved);
        mvc.perform(get("/api/connections/7")).andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Nguồn mẫu"))
            .andExpect(jsonPath("$.host").value("localhost"))
            .andExpect(jsonPath("$.port").value(3306))
            .andExpect(jsonPath("$.username").value("reader"))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.encrypted_password").doesNotExist());
    }
    @Test void createReturns201WithoutEchoingSecret() throws Exception {
        when(manager.save(any(Input.class))).thenReturn(saved);
        mvc.perform(post("/api/connections").contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(7))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(content().string(not(containsString("test-only-secret"))));
        verify(manager).save(new Input("Nguồn mẫu","localhost",3306,"source_db","reader","test-only-secret"));
    }
    @Test void testUnsavedDoesNotSave() throws Exception {
        when(manager.test(any(Input.class))).thenReturn(new TestResult(true,"Connected",List.of("scores")));
        mvc.perform(post("/api/connections/test").contentType(MediaType.APPLICATION_JSON).content(INPUT))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Connected"))
            .andExpect(jsonPath("$.tables[0]").value("scores"));
        verify(manager,never()).save(any(Input.class));
    }
    @Test void retestUsesSavedId() throws Exception {
        when(manager.test(7L)).thenReturn(new TestResult(true,"Connected",List.of("scores")));
        mvc.perform(post("/api/connections/7/test")).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
        verify(manager).test(7L);
    }
    @Test void tablesAreAStringArray() throws Exception {
        when(manager.tables(7)).thenReturn(List.of("scores","sales"));
        mvc.perform(get("/api/connections/7/tables")).andExpect(status().isOk())
            .andExpect(content().json("[\"scores\",\"sales\"]"));
    }
    @Test void columnsPreserveTypesAndNullability() throws Exception {
        when(manager.columns(7,"scores")).thenReturn(List.of(new Column("score","decimal(4,2)",false),new Column("language","varchar(2)",true)));
        mvc.perform(get("/api/connections/7/columns").param("table","scores"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("score"))
            .andExpect(jsonPath("$[0].dataType").value("decimal(4,2)"))
            .andExpect(jsonPath("$[0].nullable").value(false))
            .andExpect(jsonPath("$[1].nullable").value(true));
    }
    @ParameterizedTest
    @CsvSource({"BAD_REQUEST,INVALID_CONNECTION", "NOT_FOUND,CONNECTION_NOT_FOUND", "BAD_GATEWAY,SOURCE_CONNECTION_FAILED", "GATEWAY_TIMEOUT,SOURCE_TIMEOUT", "SERVICE_UNAVAILABLE,APP_DATABASE_UNAVAILABLE"})
    void errorsHaveStableStatusAndBody(HttpStatus status,String code) throws Exception {
        when(manager.get(7)).thenThrow(new ApiFailure(status,code,"Safe message"));
        mvc.perform(get("/api/connections/7")).andExpect(status().is(status.value()))
            .andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.message").value("Safe message"))
            .andExpect(jsonPath("$.trace").doesNotExist());
    }
    @Test void malformedJsonReturns400WithoutCallingService() throws Exception {
        mvc.perform(post("/api/connections/test").contentType(MediaType.APPLICATION_JSON).content("{broken"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(manager);
    }
    @Test void unexpectedFailureDoesNotExposeInternalSecrets() throws Exception {
        when(manager.list()).thenThrow(new IllegalStateException("internal-password-and-jdbc-details"));
        mvc.perform(get("/api/connections")).andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andExpect(content().string(not(containsString("internal-password-and-jdbc-details"))));
    }
}

