# Bước 2 Tách trách nhiệm backend

## Cấu trúc mới

```text
com.datademo.backend
├── connections
│   ├── controller/ConnectionController.java
│   ├── dto/ConnectionDtos.java
│   ├── service/ConnectionService.java
│   ├── service/ConnectionValidator.java
│   └── repository/ConnectionRepository.java
├── datasource/SourceDatabaseClient.java
├── security/PasswordCipher.java
└── common/ApiFailure.java
```

- Controller nhận và trả HTTP, giữ nguyên bảy endpoint connections và định dạng JSON/lỗi.
- DTO định nghĩa request, response không kèm mật khẩu đã lưu.
- Service điều phối kiểm tra đầu vào, kiểm tra nguồn, mã hóa rồi lưu; không chứa SQL hoặc thuật toán mã hóa.
- Repository đọc/ghi database_connections trong datademo_app. StoredConnection là dữ liệu nội bộ có mật khẩu mã hóa, không trả trực tiếp qua API.
- SourceDatabaseClient kết nối MySQL nguồn, đọc bảng có quyền SELECT và metadata cột.
- PasswordCipher quản lý AES-GCM và file khóa cục bộ.
- ConnectionValidator giữ quy tắc kiểm tra thông tin kết nối hiện tại.
- ApiFailure giữ mã lỗi và HTTP status đã có.

## Phạm vi giữ nguyên

Không thêm module nghiệp vụ. Không đổi frontend, cấu trúc database, dữ liệu điểm thi, mật khẩu, đường dẫn khóa hoặc cấu hình môi trường. Định dạng ciphertext IV:ciphertext và khóa 32 byte được giữ nguyên để tiếp tục dùng cấu hình đã lưu. Không cần chạy SQL cho bước này.

Việc CREATE TABLE IF NOT EXISTS còn ở Repository để giữ hành vi hiện tại; chuyển sang Flyway và connection pool thuộc bước kiến trúc 3, chưa thực hiện ở đây. Exception handler vẫn giữ ở Controller để tránh gộp bước chuẩn hóa lỗi/validation nâng cao vào lần tách lớp này.

## Kiểm tra

Chạy từ backend:

```powershell
.\mvnw.cmd clean test
```

Giữ 16 trường hợp hợp đồng API, hai kiểm thử mã hóa/đầu vào và kiểm thử Spring khởi động. Thêm bốn kiểm thử Service: thứ tự kiểm tra nguồn → mã hóa → lưu; lỗi nguồn không được lưu; đầu vào sai không chạm database; chỉ giải mã khi cần truy cập nguồn, không giải mã để trả chi tiết kết nối.

Các kiểm thử dùng mock hoặc thư mục khóa tạm, không ghi vào MySQL thật. Sau khi khởi động lại backend, có thể kiểm tra thủ công kết nối đã lưu → exam_scores → 8 cột như trước; việc này kiểm chứng thêm quyền MySQL và khóa hiện có trong môi trường máy người dùng.
