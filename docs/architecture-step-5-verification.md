# Kiểm tra toàn bộ luồng sau refactor

Ngày kiểm tra: 25/10/2026, múi giờ Asia/Bangkok.

## Phạm vi

Kiểm tra chức năng Kết nối MySQL đã hoàn thành và phần chọn nguồn/bảng của Dataset. Chưa triển khai đặt tên, xem trước, sửa nhãn hoặc lưu dataset; Chart Builder/Dashboard nghiệp vụ vẫn ngoài lần kiểm tra này.

## Kết quả

| Nhóm kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Backend thông thường | 25/25 đạt | Khởi động, hợp đồng HTTP, Service, mã hóa, migration, Repository và pool bằng H2 |
| Frontend thông thường | 10/10 đạt | HTTP client, routing, retry, URL sai, cache không chứa mật khẩu |
| Tích hợp HTTP/MySQL thật | 1/1 đạt | Kiểm tra, lưu thử, đọc lại, kiểm tra lại, metadata và lỗi quyền truy cập |
| Chrome với frontend/backend/MySQL thật | 3/3 đạt | Điều hướng, tải lại, mật khẩu sai, tìm kiếm và viewport 390px |
| Build frontend | Thành công | TypeScript và Vite; còn cảnh báo bundle lớn đã biết |

Tổng 39 trường hợp kiểm thử đạt. Bộ tích hợp MySQL dùng nguồn đã được lưu trong datademo_app, giải mã đúng credential nguồn bằng khóa hiện có; không lấy mật khẩu tài khoản ứng dụng làm mật khẩu reader.

## Luồng MySQL thật

Kiểm tra `/api/health`, test nguồn, tạo kết nối thử với tên duy nhất, đọc chi tiết không chứa mật khẩu, kiểm tra lại theo ID, danh sách bảng, 8 cột exam_scores, từ chối bảng không hợp lệ, thông báo 502 khi mật khẩu sai.

Mật khẩu lưu thử là ciphertext và giải mã được bằng cùng khóa. Bản ghi thử được xóa theo đúng ID và tên duy nhất trong finally. Đối chiếu toàn bộ các trường của những bản ghi cấu hình trước/sau khớp nhau. Bộ đếm AUTO_INCREMENT có thể tăng qua bản ghi thử đã xóa, đây không phải mất dữ liệu.

Dữ liệu nguồn chỉ đọc. Đối chiếu trước/sau: 140.567 dòng điểm, 35.526 thí sinh; tổng điểm, min và max không đổi. Không sửa hoặc xóa dữ liệu điểm thi.

## Luồng Chrome

1. Chọn MySQL local, đọc bảng exam_scores và 8 cột.
2. Kiểm tra lại nguồn thành công.
3. Tạo dataset từ bảng này chuyển tới `/datasets?connectionId=...&table=exam_scores`.
4. Back/Forward đúng màn hình; reload Dataset đọc lại nguồn và giữ bảng từ URL.
5. Sai mật khẩu có lỗi MySQL rõ ràng, không tạo kết nối.
6. Tìm kiếm không có kết quả rồi xóa tìm kiếm hoạt động; viewport 390px không làm tràn ngang toàn trang.
7. Luồng chính không có JavaScript pageerror.

Sau khi reload toàn bộ trang, state lựa chọn kết nối trong layout được đặt lại. Khi quay về Kết nối có thể cần chọn lại bản ghi; dữ liệu cấu hình vẫn nằm trong MySQL. Đây là trạng thái giao diện tạm, không phải cấu hình bị mất.

## Chạy lại

Backend thông thường (không cần MySQL thật):

```powershell
cd D:\Project\DataDemo\backend
.\mvnw.cmd test
```

Tích hợp MySQL chủ đích, có tạo/xóa một bản ghi cấu hình thử:

```powershell
.\mvnw.cmd '-Dtest=ConnectionFlowMySqlIT' test
```

Frontend:

```powershell
cd D:\Project\DataDemo\frontend
npm test
npm run build
npm run test:e2e
```

E2E cần MySQL thật, Chrome đã cài và cấu hình application-local.properties hợp lệ. Cần có kết nối MySQL local đã lưu tới datademo_source. Playwright mở server kiểm thử ở 15173/18080 và đóng khi xong, không tái sử dụng hay dừng server người dùng. Vite cho phép DATADEMO_API_TARGET để đổi proxy cho kiểm thử; mặc định vẫn localhost:8080. Không thêm endpoint sản phẩm mới.

Kiểm thử tự động không thay cho kiểm chứng tính chính xác của nguồn dữ liệu thi hoặc chức năng chưa xây. Không có thao tác push GitHub trong lần kiểm tra này.
