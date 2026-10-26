package com.datademo.backend.security;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import com.datademo.backend.common.ApiFailure;
@Component
public class PasswordCipher {
    private final Path keyPath;
    public PasswordCipher(@Value("${datademo.key-file}") String path) { keyPath=Path.of(path); }
    private synchronized byte[] key(boolean create)throws Exception{
        if(!Files.exists(keyPath)&&create){Files.createDirectories(keyPath.toAbsolutePath().getParent());byte[] value=new byte[32];new SecureRandom().nextBytes(value);try{Files.write(keyPath,value,StandardOpenOption.CREATE_NEW);}catch(FileAlreadyExistsException ignored){}}
        byte[] value=Files.readAllBytes(keyPath);if(value.length!=32)throw new IllegalStateException();return value;
    }
    public String encrypt(String value){try{byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(true),"AES"),new GCMParameterSpec(128,iv));return Base64.getEncoder().encodeToString(iv)+":"+Base64.getEncoder().encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw cipherError();}}
    public String decrypt(String value){try{String[] parts=value.split(":",2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key(false),"AES"),new GCMParameterSpec(128,Base64.getDecoder().decode(parts[0])));return new String(c.doFinal(Base64.getDecoder().decode(parts[1])),StandardCharsets.UTF_8);}catch(Exception e){throw cipherError();}}
    private ApiFailure cipherError(){return new ApiFailure(HttpStatus.INTERNAL_SERVER_ERROR,"ENCRYPTION_ERROR","Không đọc được khóa mã hóa cục bộ. Giữ nguyên backend/.local/connection.key để mở các kết nối đã lưu.");}
}
