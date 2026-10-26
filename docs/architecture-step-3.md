# Bước 3 Flyway và pool database ứng dụng

## Thay đổi

- Spring Boot JDBC tạo DataSource dùng HikariCP cho datademo_app: tối đa 5 kết nối, tối thiểu 1 kết nối chờ, thời gian chờ lấy kết nối 5 giây.
- Repository dùng JdbcTemplate, tự trả kết nối về pool; timeout truy vấn 10 giây.
- Không còn CREATE TABLE hoặc DriverManager trong Repository.
- Spring Boot Flyway chạy migration khi backend khởi động, trước khi phục vụ API.
- V1__create_database_connections.sql quản lý bảng kết nối. Các migration tiếp theo dùng V2, V3…; không sửa V1 sau khi đã áp dụng.

## Giữ nguyên

API và JSON, database nguồn, bảng exam_scores, dữ liệu điểm thi, cấu hình tài khoản, vị trí khóa và ciphertext hiện tại. SourceDatabaseClient vẫn dùng kết nối nguồn riêng với quyền đọc; không đưa nguồn vào Flyway hoặc pool ứng dụng.

File application-local.properties và biến DATADEMO_APP_* tiếp tục sử dụng như trước, không cần nhập lại mật khẩu. Không đưa file chứa mật khẩu hoặc khóa vào Git.

## Tiếp nhận database PoC có sẵn

baseline-on-migrate=true và baseline-version=0 cho phép tiếp nhận datademo_app đã có bảng nhưng chưa có lịch sử Flyway. V1 dùng CREATE TABLE IF NOT EXISTS, không xóa, cập nhật hay sao chép bản ghi cũ. Flyway thêm bảng flyway_schema_history để theo dõi phiên bản. Không baseline ở phiên bản 1 vì sẽ bỏ qua V1 trong database cũ.

Flyway clean bị tắt. Không dùng clean hoặc xóa lịch sử để xử lý lỗi checksum. Nếu bảng cũ có cấu trúc khác dự kiến, cần kiểm tra và tạo migration sửa có chủ đích; IF NOT EXISTS không tự chuẩn hóa bảng sai cấu trúc.

Chỉ cấu hình database ứng dụng cho spring.datasource / datademo.app.url. Không trỏ đến database nguồn. Tài khoản hiện có quyền CREATE, SELECT, INSERT, UPDATE, DELETE đủ cho V1; migration tương lai dùng ALTER sẽ cần quyền bổ sung hoặc tài khoản migration riêng.

## Kiểm thử

```powershell
cd D:\Project\DataDemo\backend
.\mvnw.cmd test
```

25 kiểm thử mặc định: 23 kiểm thử cũ và 2 kiểm thử migration/Repository với H2 chế độ MySQL. Kiểm tra tạo mới, không chạy lặp, baseline database cũ, giữ nguyên ID/ciphertext và trả kết nối về pool. H2 không thay thế kiểm thử MySQL thật.

Kiểm thử MySQL thật được tách thành thao tác chủ đích:

```powershell
.\mvnw.cmd '-Dtest=AppDatabaseMySqlIT' test
```

Lệnh này đọc application-local.properties, chỉ cho phép catalog datademo_app, chạy migration thật và so sánh SHA-256 của toàn bộ các trường bản ghi kết nối trước/sau. Không xuất mật khẩu hoặc ciphertext. Kiểm tra chạy lần hai không có migration mới. Không nằm trong bộ test mặc định.

## Chạy ứng dụng

Khởi động lại backend từ thư mục backend như trước. MySQL và datademo_app phải sẵn sàng ngay khi backend khởi động; cấu hình sai sẽ khiến backend dừng sớm thay vì chỉ báo lỗi khi mở danh sách. Đây là thay đổi vòng đời cần thiết để đảm bảo schema đã sẵn sàng.

Frontend không thay đổi. Sau khi chạy lại, kiểm tra Kết nối đã lưu → exam_scores → 8 cột. Không cần chạy SQL thủ công cho V1 đã áp dụng.

Tài liệu tham khảo: https://docs.spring.io/spring-boot/how-to/data-initialization.html
