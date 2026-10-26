package com.datademo.backend.connection;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.Path;
import com.datademo.backend.security.PasswordCipher;
import com.datademo.backend.connections.service.ConnectionValidator;
import com.datademo.backend.connections.dto.ConnectionDtos.Input;
import com.datademo.backend.common.ApiFailure;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ConnectionComponentsTests {
    @TempDir Path directory;
    private PasswordCipher manager(String key){return new PasswordCipher(key);}
    @Test void encryptionPersistsAndDetectsTampering(){
        String key=directory.resolve("connection.key").toString();
        PasswordCipher m=manager(key);
        String a=m.encrypt("test-secret"),b=m.encrypt("test-secret");
        assertNotEquals(a,b);assertFalse(a.contains("test-secret"));
        assertEquals("test-secret",manager(key).decrypt(a));
        assertThrows(ApiFailure.class,()->manager(directory.resolve("missing.key").toString()).decrypt(a));
        assertThrows(ApiFailure.class,()->m.decrypt(a.substring(0,a.length()-4)+"AAAA"));
    }
    @Test void rejectsJdbcOptionsAndInvalidPorts(){
        ConnectionValidator m=new ConnectionValidator();
        assertThrows(ApiFailure.class,()->m.validate(new Input("demo","localhost?x=1",3306,"db","reader","")));
        assertThrows(ApiFailure.class,()->m.validate(new Input("demo","localhost",3306,"db?x=1","reader","")));
        assertThrows(ApiFailure.class,()->m.validate(new Input("demo","localhost",0,"db","reader","")));
        assertEquals("",m.validate(new Input("demo","localhost",3306,"db","reader",null)).password());
    }
}


