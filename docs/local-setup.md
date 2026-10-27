# Hướng dẫn cài đặt và chạy local

Các đường dẫn và lệnh được tính từ thư mục gốc project. Xem [README](../README.md) để biết tổng quan chức năng.

## Chuẩn bị môi trường

- JDK 21; các lệnh `java` và `javac` có trong PATH.
- Node.js đáp ứng `^20.19.0`, `^22.13.0` hoặc `>=24.0.0`, cùng npm. Dải phiên bản này đáp ứng Vite và bộ kiểm thử frontend hiện tại.
- MySQL Server 8 đang chạy; MySQL Workbench để thực hiện SQL.
- Git. Backend có Maven Wrapper, không cần cài Maven riêng.

Các lệnh bên dưới dùng **PowerShell trên Windows**, bắt đầu từ thư mục repository đã clone.

```powershell
git clone https://github.com/HuyThanh05/DataDemo.git
cd DataDemo
```

### 1. Tạo database và tài khoản

Mở MySQL Workbench bằng tài khoản quản trị (ví dụ `root`), chạy:

```sql
CREATE DATABASE IF NOT EXISTS datademo_source
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS datademo_app
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'datademo_reader'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_YOUR_READER_PASSWORD';
GRANT SELECT ON datademo_source.* TO 'datademo_reader'@'localhost';
```

Thay mật khẩu mẫu trước khi chạy. Sau đó mở [scripts/setup-step-7.sql](../scripts/setup-step-7.sql), thay `REPLACE_WITH_YOUR_APP_PASSWORD` bằng mật khẩu riêng cho tài khoản ứng dụng rồi chạy. Script cấp quyền đọc/ghi cấu hình, tạo bảng và `REFERENCES` trong `datademo_app`.

`CREATE USER IF NOT EXISTS` không đổi mật khẩu của tài khoản đã tồn tại. Nếu đã cấu hình các tài khoản này, sử dụng mật khẩu hiện có. Tài khoản nguồn và tài khoản ứng dụng có thể đặt mật khẩu khác nhau.

### 2. Chuẩn bị bảng dữ liệu nguồn

**CSV và bản sao database không được đưa lên GitHub.** Clone repository không tự có dữ liệu demo hoặc các cấu hình đã lưu trên máy người phát triển. Người review cần được cung cấp CSV đã xử lý, hoặc chuẩn bị một bảng MySQL khác để thử luồng.

Bộ dữ liệu đang dùng là mẫu điểm thi THPT Đà Nẵng năm 2026, gồm **35.526 thí sinh và 140.567 dòng điểm** sau chuẩn bị; mỗi dòng là điểm một môn của một thí sinh. Số liệu và nguồn cộng đồng được ghi lại trong [báo cáo xác minh](data-verification-2026.json). Báo cáo kiểm tra tính nhất quán nội bộ; chưa xác nhận độ khớp với dữ liệu chính thức hoặc cập nhật phúc khảo.

Nếu nhận file đã lọc Đà Nẵng `data/raw/diem_thi_2026_da_nang.csv`, từ thư mục gốc chạy:

```powershell
node scripts/prepare-data.mjs
```

Script xuất `data/processed/diem_thi_2026_da_nang_long.csv`. Script này xử lý file Đà Nẵng có sẵn, không tự tải hoặc lọc file toàn quốc. Xem [quy tắc chuẩn bị dữ liệu](data-preparation.md).

Để nhập CSV đã xử lý, tạo bảng bằng tài khoản quản trị:

```sql
CREATE TABLE IF NOT EXISTS datademo_source.exam_scores (
  candidate_id VARCHAR(8) NOT NULL,
  exam_year SMALLINT NOT NULL,
  province_code CHAR(2) NOT NULL,
  province_name VARCHAR(100) NOT NULL,
  subject_code VARCHAR(40) NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  foreign_language_code VARCHAR(2) NULL,
  score DECIMAL(4,2) NOT NULL,
  PRIMARY KEY (exam_year, candidate_id, subject_code)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SHOW VARIABLES LIKE 'secure_file_priv';
```

Nếu `secure_file_priv` trả về một thư mục, copy CSV vào đúng thư mục đó và thay đường dẫn bên dưới cho khớp. Nếu trả về `NULL`, server đang tắt chức năng nhập file; cần chọn phương thức nhập khác. Lệnh sau dành cho bảng mới chưa nhập dữ liệu:

```sql
LOAD DATA INFILE
  'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/diem_thi_2026_da_nang_long.csv'
INTO TABLE datademo_source.exam_scores
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(candidate_id, exam_year, province_code, province_name,
 subject_code, subject_name, @language_code, score)
SET foreign_language_code = NULLIF(@language_code, '');

SELECT COUNT(*) AS score_rows,
       COUNT(DISTINCT candidate_id) AS candidates,
       MIN(score) AS min_score, MAX(score) AS max_score
FROM datademo_source.exam_scores;
```

Với đúng bản CSV demo đã kiểm tra, kết quả là `140567`, `35526`, `0.00`, `10.00`. Header CSV dùng tiếng Việt không dấu; câu lệnh nhập ánh xạ theo thứ tự sang tên cột tiếng Anh ở bảng trên.

### 3. Cấu hình backend

Từ thư mục gốc:

```powershell
Copy-Item backend/application-local.properties.example backend/application-local.properties
```

Chỉ copy khi chưa có file cấu hình riêng. Mở `backend/application-local.properties`, điền tài khoản ứng dụng:

```properties
datademo.app.username=datademo_app_user
datademo.app.password=REPLACE_WITH_YOUR_APP_PASSWORD
```

Mặc định backend kết nối `datademo_app` tại `localhost:3306`. Nếu cần đổi địa chỉ, đặt thêm `datademo.app.url` trong file này. Backend cũng hỗ trợ biến môi trường `DATADEMO_APP_URL`, `DATADEMO_APP_USER`, `DATADEMO_APP_PASSWORD` khi không ghi đè các giá trị tương ứng bằng file local.

File chứa mật khẩu và thư mục `backend/.local/` đã được bỏ qua bởi Git. Mật khẩu nguồn được mã hóa AES-GCM khi lưu kết nối. **Giữ lại `backend/.local/connection.key` nếu dùng lại cấu hình kết nối đã lưu**; khóa này được tạo khi cần mã hóa, mất khóa sẽ không giải mã được mật khẩu cũ. Không đưa khóa lên GitHub.

## Chạy project

Giữ hai terminal chạy đồng thời.

**Terminal 1 — backend**, từ thư mục gốc:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Phải chạy từ thư mục `backend` để đọc đúng file local. MySQL và tài khoản ứng dụng cần sẵn sàng; Flyway tự tạo/cập nhật các bảng cấu hình lúc khởi động.

Kiểm tra [http://localhost:8080/api/health](http://localhost:8080/api/health), kết quả mong đợi:

```text
DataDemo backend is running
```

**Terminal 2 — frontend**, từ thư mục gốc:

```powershell
cd frontend
npm ci
npm run dev
```

Mở URL **Local** mà Vite in ra, thường là [http://localhost:5173](http://localhost:5173). Nếu cổng bận, Vite có thể chọn cổng khác. Frontend chuyển tiếp `/api` đến backend `localhost:8080`.

`npm run build` tạo bản build, không khởi động server để xem giao diện. Khi phát triển hoặc demo local, dùng `npm run dev`.

