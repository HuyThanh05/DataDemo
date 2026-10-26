package com.datademo.backend.connections.service;
import java.util.List;
import com.datademo.backend.connections.dto.ConnectionDtos.*;
import com.datademo.backend.connections.repository.ConnectionRepository;
import com.datademo.backend.datasource.SourceDatabaseClient;
import com.datademo.backend.security.PasswordCipher;
import org.springframework.stereotype.Service;

@Service
public class ConnectionService {
    private final ConnectionRepository repository;
    private final SourceDatabaseClient source;
    private final PasswordCipher cipher;
    private final ConnectionValidator validator;
    public ConnectionService(ConnectionRepository repository,SourceDatabaseClient source,PasswordCipher cipher,ConnectionValidator validator){this.repository=repository;this.source=source;this.cipher=cipher;this.validator=validator;}
    public List<View> list(){return repository.list();}
    public View get(long id){return repository.get(id);}
    public TestResult test(Input input){return source.test(validator.validate(input));}
    public TestResult test(long id){return test(storedInput(id));}
    public List<String> tables(long id){return source.tables(storedInput(id));}
    public List<Column> columns(long id,String table){return source.columns(storedInput(id),table);}
    public com.datademo.backend.datasource.DistinctValues distinctValues(long id,String table,String column) { return source.distinctValues(storedInput(id),table,column); }
    public com.datademo.backend.datasource.TablePreview previewTable(long id, String table) {
        return source.preview(storedInput(id), table);
    }
    public View save(Input input){
        Input validated=validator.validate(input);
        source.test(validated);
        return repository.save(validated,cipher.encrypt(validated.password()));
    }
    public com.datademo.backend.charts.ChartDtos.Preview aggregate(long id, String table, com.datademo.backend.charts.ChartDtos.Plan plan) {
        return source.aggregate(storedInput(id), table, plan);
    }
    private Input storedInput(long id){
        var stored=repository.find(id);View view=stored.view();
        return new Input(view.name(),view.host(),view.port(),view.databaseName(),view.username(),cipher.decrypt(stored.encryptedPassword()));
    }
}
