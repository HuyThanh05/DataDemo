package com.datademo.backend.connection;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ConnectionManagerTests {
    @TempDir Path directory;
    private ConnectionManager manager(String key){return new ConnectionManager("unused","unused","unused",key);}
    @Test void encryptionPersistsAndDetectsTampering(){
        String key=directory.resolve("connection.key").toString();
        ConnectionManager m=manager(key);
        String a=m.encrypt("test-secret"),b=m.encrypt("test-secret");
        assertNotEquals(a,b);assertFalse(a.contains("test-secret"));
        assertEquals("test-secret",manager(key).decrypt(a));
        assertThrows(ConnectionManager.Failure.class,()->manager(directory.resolve("missing.key").toString()).decrypt(a));
        assertThrows(ConnectionManager.Failure.class,()->m.decrypt(a.substring(0,a.length()-4)+"AAAA"));
    }
    @Test void rejectsJdbcOptionsAndInvalidPorts(){
        ConnectionManager m=manager(directory.resolve("key").toString());
        assertThrows(ConnectionManager.Failure.class,()->m.validate(new ConnectionManager.Input("demo","localhost?x=1",3306,"db","reader","")));
        assertThrows(ConnectionManager.Failure.class,()->m.validate(new ConnectionManager.Input("demo","localhost",3306,"db?x=1","reader","")));
        assertThrows(ConnectionManager.Failure.class,()->m.validate(new ConnectionManager.Input("demo","localhost",0,"db","reader","")));
        assertEquals("",m.validate(new ConnectionManager.Input("demo","localhost",3306,"db","reader",null)).password());
    }
}
