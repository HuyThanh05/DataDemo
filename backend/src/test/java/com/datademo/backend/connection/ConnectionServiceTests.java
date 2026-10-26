package com.datademo.backend.connection;

import com.datademo.backend.common.ApiFailure;
import com.datademo.backend.connections.dto.ConnectionDtos.*;
import com.datademo.backend.connections.repository.ConnectionRepository;
import com.datademo.backend.connections.repository.ConnectionRepository.StoredConnection;
import com.datademo.backend.connections.service.ConnectionService;
import com.datademo.backend.connections.service.ConnectionValidator;
import com.datademo.backend.datasource.SourceDatabaseClient;
import com.datademo.backend.security.PasswordCipher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConnectionServiceTests {
    private ConnectionRepository repository;
    private SourceDatabaseClient source;
    private PasswordCipher cipher;
    private ConnectionService service;
    private final Input input = new Input("Demo", "localhost", 3306, "source", "reader", "test-secret");

    @BeforeEach void setup() {
        repository = mock(ConnectionRepository.class);
        source = mock(SourceDatabaseClient.class);
        cipher = mock(PasswordCipher.class);
        service = new ConnectionService(repository, source, cipher, new ConnectionValidator());
    }

    @Test void sourceMustSucceedBeforeEncryptionAndPersistence() {
        when(cipher.encrypt(input.password())).thenReturn("encrypted-value");
        service.save(input);
        var order = inOrder(source, cipher, repository);
        order.verify(source).test(input);
        order.verify(cipher).encrypt("test-secret");
        order.verify(repository).save(input, "encrypted-value");
    }

    @Test void failingSourceNeverSavesOrEncrypts() {
        when(source.test(input)).thenThrow(new ApiFailure(HttpStatus.BAD_GATEWAY, "SOURCE_ACCESS_DENIED", "Denied"));
        assertThrows(ApiFailure.class, () -> service.save(input));
        verifyNoInteractions(repository, cipher);
    }

    @Test void invalidInputNeverTouchesEitherDatabase() {
        var invalid = new Input("Demo", "localhost?x=true", 3306, "source", "reader", "test-secret");
        assertThrows(ApiFailure.class, () -> service.save(invalid));
        verifyNoInteractions(repository, source, cipher);
    }

    @Test void savedConnectionDecryptsOnlyForSourceAccess() {
        View view = new View(7, "Demo", "localhost", 3306, "source", "reader");
        when(repository.get(7)).thenReturn(view);
        assertEquals(view, service.get(7));
        verifyNoInteractions(cipher, source);

        when(repository.find(7)).thenReturn(new StoredConnection(view, "encrypted-value"));
        when(cipher.decrypt("encrypted-value")).thenReturn("test-secret");
        service.tables(7);
        verify(source).tables(input);
    }
}
