# Bước 1 Ghi nhận hợp đồng trước khi refactor

## Phạm vi

Giữ nguyên yêu cầu và API đã duyệt của module Kết nối MySQL. Không thay đổi mã production, giao diện, cấu trúc MySQL hoặc dữ liệu. Chưa làm các phần còn lại của Dataset, Chart Builder, Dashboard, Security hoặc SQL Lab.

## Kiểm thử tự động

File: backend/src/test/java/com/datademo/backend/ConnectionApiContractTests.java.

16 trường hợp mới kiểm tra health, bảy endpoint connections, danh sách rỗng, response không lộ mật khẩu, status 201 khi tạo, kiểm tra chưa lưu không gọi thao tác lưu, metadata nullable và các lỗi 400/404/502/503/504/500. JSON lỗi thống nhất có code và message; lỗi nội bộ không lộ chi tiết bí mật.

Kết hợp 3 kiểm thử sẵn có về khởi động, đầu vào kết nối và mã hóa: tổng cộng 19 kiểm thử, không lỗi, không bỏ qua. Chạy từ backend:

```powershell
.\mvnw.cmd test
```

Các kiểm thử HTTP dùng MockMvc và giả lập ConnectionManager. Chúng ghi nhận hợp đồng frontend/backend, không khẳng định MySQL thật đã hoạt động hoặc SQL đúng. Kiểm thử tích hợp MySQL sẽ được bổ sung khi tách lớp truy cập dữ liệu.

## Luồng đối chiếu giao diện sau mỗi lần refactor

1. Trang Kết nối đọc danh sách đã lưu; tìm theo tên/database.
2. Nhập thông tin tài khoản nguồn chỉ đọc; Kiểm tra kết nối trả kết quả thật, chưa lưu cấu hình.
3. Lưu kiểm tra lại nguồn trước khi ghi datademo_app; không trả lại mật khẩu.
4. Chọn kết nối đã lưu, đọc bảng exam_scores và đúng 8 cột/kiểu dữ liệu/nullable.
5. Kiểm tra lại kết nối đã lưu, tải lại trang và khởi động lại backend vẫn đọc được cấu hình.
6. Sai mật khẩu, sai port, thiếu cấu hình ứng dụng: lỗi rõ ràng, không lộ mật khẩu.
7. Phần Dataset đã có chỉ chọn kết nối/bảng; không tự tạo, lưu hoặc xem trước dataset ở bước kiến trúc này.

Checklist giao diện chưa tự động hóa và không được tính vào 19 kiểm thử đã chạy.

## Tiếp theo

Tách Controller, DTO, Service, Repository, SourceDatabaseClient và PasswordCipher, rồi chạy lại bộ hợp đồng trên. Không đổi endpoint hoặc mở rộng chức năng trong lần tách lớp.
