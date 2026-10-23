# Bước 7 Kết nối database

Đã triển khai màn hình và API kết nối MySQL thật. Các chức năng Dataset, Chart Builder và Dashboard chưa triển khai.

## Cấu hình để dùng nút Lưu

Tài khoản `datademo_reader` chỉ đọc `datademo_source`. Cần tài khoản riêng để ghi cấu hình kết nối vào `datademo_app`.

1. Mở `scripts/setup-step-7.sql` bằng Workbench với root.
2. Thay `REPLACE_WITH_YOUR_APP_PASSWORD` bằng mật khẩu bạn tự chọn, rồi chạy script. Nếu tài khoản đã tồn tại, CREATE USER IF NOT EXISTS không đổi mật khẩu cũ.
3. Copy `backend/application-local.properties.example` thành `backend/application-local.properties`.
4. Điền mật khẩu vừa đặt vào `datademo.app.password` (không phải mật khẩu reader). Nếu mật khẩu chứa dấu gạch chéo ngược, phải ghi thành hai dấu trong file properties.
5. File này được bỏ qua bởi Git. Không gửi mật khẩu vào chat.

Backend tự tạo bảng database_connections trong datademo_app khi truy cập danh sách hoặc lưu kết nối. Chỉ bảng của bước 7 được tạo.

## Chạy và thử

Chạy backend với working directory là `backend` để đọc đúng file cấu hình:

```powershell
cd D:\Project\DataDemo\backend
.\mvnw.cmd spring-boot:run
```

Chạy frontend trong terminal khác:

```powershell
cd D:\Project\DataDemo\frontend
npm run dev
```

Mở URL Local của Vite. Nhập tên kết nối, localhost, 3306, datademo_source, datademo_reader và mật khẩu nguồn đã đặt ở bước 6.

- Kiểm tra kết nối: không cần cấu hình tài khoản datademo_app. Hiển thị kết quả thật và số bảng đọc được.
- Lưu: kiểm tra lại nguồn rồi lưu cấu hình trong datademo_app.
- Chọn kết nối đã lưu: đọc các bảng, chọn exam_scores để xem đúng 8 cột.
- Kiểm tra lại: dùng thông tin đã lưu, không cần nhập lại mật khẩu.
- Tải lại trình duyệt/khởi động lại backend: cấu hình vẫn tồn tại.
- Thử mật khẩu sai, port sai và các trường trống để kiểm tra lỗi.

## Bảo vệ mật khẩu

Mật khẩu nguồn được mã hóa AES-GCM trước khi lưu, không trả về frontend hoặc ghi vào log.
Khóa ngẫu nhiên nằm tại backend/.local/connection.key, tách khỏi database và bị bỏ qua bởi Git.
Không xóa khóa như file tạm: mất khóa sẽ không mở được mật khẩu các kết nối đã lưu. Đây là cơ chế PoC cục bộ, chưa phải quản lý khóa production.

Chưa có đăng nhập/phân quyền; chỉ chạy cục bộ. Dùng tài khoản nguồn chỉ đọc đã chuẩn bị. Khóa và cấu hình có thể thay bằng DATADEMO_KEY_FILE, DATADEMO_APP_URL, DATADEMO_APP_USER, DATADEMO_APP_PASSWORD.

## API

| Method | Đường dẫn | Chức năng |
|---|---|---|
| POST | /api/connections/test | Kiểm tra thông tin chưa lưu |
| POST | /api/connections | Kiểm tra lại và lưu |
| GET | /api/connections | Danh sách không có mật khẩu |
| GET | /api/connections/{id} | Chi tiết không có mật khẩu |
| POST | /api/connections/{id}/test | Kiểm tra lại kết nối đã lưu |
| GET | /api/connections/{id}/tables | Bảng có quyền SELECT |
| GET | /api/connections/{id}/columns?table=exam_scores | Tên cột, kiểu và nullable |

Timeout kết nối 5 giây, socket và truy vấn 10 giây. Không hỗ trợ SQL tùy ý hoặc sửa/xóa kết nối ở bước này. Danh sách bảng chỉ gồm bảng vật lý trong database đã cấu hình.
