# Xóa cấu hình đã lưu

Đã bổ sung nút **Xóa** tại Kết nối đã lưu, Dataset đã lưu, Biểu đồ đã lưu và Dashboard đã lưu. Mỗi thao tác mở hộp xác nhận ghi đúng tên đối tượng; bấm Hủy không gửi yêu cầu xóa. Nếu còn phụ thuộc, lỗi được hiển thị ngay trong hộp xác nhận và dữ liệu trên màn hình được giữ nguyên.

| Đối tượng | Quy tắc |
| --- | --- |
| Dashboard | Xóa dashboard, liên kết biểu đồ, bố cục và bộ lọc của dashboard đó. Giữ nguyên biểu đồ gốc, dataset và kết nối. |
| Biểu đồ | Chỉ xóa khi đã gỡ khỏi tất cả dashboard. |
| Dataset | Chỉ xóa khi không còn biểu đồ và không còn bộ lọc dashboard tham chiếu. Xóa kèm các nhãn cột của chính dataset. |
| Kết nối | Chỉ xóa khi không còn dataset sử dụng. |

Việc xóa chỉ truy cập database cấu hình ứng dụng; không mở kết nối nguồn, không sửa hoặc xóa bảng dữ liệu nguồn. Không xóa khóa mã hóa dùng chung.

Nếu dataset còn được tham chiếu bởi bộ lọc của một dashboard đã gỡ hết biểu đồ, mở dashboard đó và bấm **Tắt bộ lọc chung**, hoặc xóa dashboard nếu không còn sử dụng.

## API

| Method | Đường dẫn |
| --- | --- |
| DELETE | `/api/connections/{id}` |
| DELETE | `/api/datasets/{id}` |
| DELETE | `/api/charts/{id}` |
| DELETE | `/api/dashboards/{id}` |

- Thành công: `204 No Content`.
- Còn phụ thuộc: `409 Conflict`, thông báo nêu loại và số đối tượng liên quan khi xác định được.
- Không còn tồn tại: `404 Not Found`.
- Các lệnh ghi chạy trong transaction; khóa hàng đối tượng trước khi kiểm tra và xóa. Khóa ngoại vẫn bảo vệ các tham chiếu phát sinh đồng thời. Nếu có lỗi, transaction hoàn tác, kể cả các nhãn cột đã được xóa trong transaction đó.
- Không bổ sung hoặc chỉnh sửa migration; sử dụng các bảng và khóa ngoại hiện có.

Sau khi xóa thành công, giao diện cập nhật danh sách, bỏ cache liên quan và thoát đối tượng đang mở để không tiếp tục sửa cấu hình đã bị xóa.

## Chạy và kiểm tra

Khởi động lại backend để nạp bốn API mới, giữ frontend chạy bằng `npm run dev`, rồi tải lại trình duyệt. Không cần chạy SQL hoặc cấp thêm quyền nếu tài khoản ứng dụng đã có quyền DELETE như script thiết lập hiện tại.

Các kiểm thử liên quan:

- `ConfigurationDeletionTests`: API và database H2, quan hệ phụ thuộc, giữ cấu hình dùng chung, bộ lọc còn tham chiếu, rollback và đối tượng không tồn tại.
- `ConfigurationDeletionMySqlIT`: kiểm thử chủ động trên MySQL cục bộ; tạo các bản ghi riêng, chỉ xóa đúng các ID đó và so sánh dấu kiểm của mọi dòng cấu hình có trước. Không truy cập nguồn dữ liệu.
- `DeleteSavedButton.test.tsx`, `http.test.ts`: xác nhận, hủy, lỗi phụ thuộc, thử lại và phản hồi DELETE 204.
- `configuration-delete.spec.ts`: Chrome với API giả lập; đi qua đủ bốn màn hình, chặn sai thứ tự, xóa đúng thứ tự, xóa đối tượng đang mở và tải lại trang.

```powershell
# Backend: kiểm thử thông thường với H2
cd D:\Project\DataDemo\backend
.\mvnw.cmd test

# Kiểm thử MySQL thật, chỉ chạy khi chủ động kiểm chứng
.\mvnw.cmd -Dtest=ConfigurationDeletionMySqlIT test

# Frontend
cd D:\Project\DataDemo\frontend
npm test -- --maxWorkers=1
npm run test:e2e -- e2e/configuration-delete.spec.ts
```
