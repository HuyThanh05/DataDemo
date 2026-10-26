# Bước 8 phần 3 Xem trước dữ liệu

Chọn kết nối và bảng trên Dataset để tự tải mẫu MySQL thật. Xem trước không yêu cầu tên hoặc dataset đã lưu, không ghi vào datademo_app và không thay đổi dữ liệu nguồn. Tên dataset vẫn chỉ là bản nháp trên frontend.

## API bổ sung

POST /api/datasets/preview

```json
{ "connectionId": 1, "tableName": "exam_scores" }
```

Response gồm columns (name, dataType), rows (mảng giá trị theo thứ tự cột) và limit=100. Đây là API xem trước dataset chưa lưu; GET /api/datasets/{id}/preview theo thiết kế ban đầu sẽ được triển khai khi có dataset lưu.

DatasetController → DatasetService → ConnectionService → SourceDatabaseClient. Tái sử dụng kết nối đã lưu và khóa mã hóa; không nhận credential hoặc SQL từ frontend. Tên bảng phải thuộc metadata bảng vật lý được phép SELECT rồi mới được quote. SQL giới hạn cố định LIMIT 100, setMaxRows 100, timeout 10 giây và session read-only. Không có ORDER BY: đây là mẫu tối đa 100 dòng, không cam kết mẫu ngẫu nhiên hoặc thứ tự cố định.

## Giao diện

- Tự xem trước khi chọn nguồn hợp lệ, có loading, lỗi/thử lại và nút làm mới.
- Hiển thị 10 dòng/trang trong tối đa 100 dòng đã tải; không lấy tiếp toàn bộ bảng.
- Đổi nguồn sử dụng query key riêng, không trộn kết quả từ bảng cũ.
- NULL hiển thị rõ, không biến thành 0; chuỗi rỗng hiển thị (trống).
- Decimal và số nguyên dài được truyền dạng chuỗi để giữ độ chính xác; số 0 giữ đúng.
- Ô văn bản xem trước giới hạn 2.000 ký tự, dữ liệu nhị phân hiển thị mô tả thay vì nội dung.
- Số dòng mẫu không phải tổng số dòng của bảng.

## Kiểm tra đã chạy

- Backend: 29 kiểm thử đạt.
- Frontend: 11 kiểm thử đạt; build thành công.
- HTTP/MySQL thật: 1 kiểm thử đạt, xác nhận 100 dòng/8 cột, chặn tên bảng chứa SQL, đối chiếu cấu hình và thống kê điểm thi không đổi.
- Chrome: 3 kiểm thử đạt; gồm hiển thị 100 dòng mẫu, phân trang 10 dòng, làm mới, điều hướng, reload và luồng cũ.

Không cần SQL hay migration mới. Khởi động lại backend, giữ frontend chạy và mở Dataset → MySQL local → exam_scores. Phần tiếp theo là đặt tên hiển thị cho cột, sau đó lưu dataset.
