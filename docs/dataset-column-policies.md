# Vai trò cột và phép tổng hợp trong Dataset

Mỗi cột có `role`, `allowedAggregations` và `defaultAggregation`, lưu trong `datademo_app.dataset_column_settings` bằng Flyway V8; V9 chuẩn hóa vai trò Phân nhóm. Giữ `canAggregate` trong API để tương thích; cờ này chỉ mô tả khả năng số học theo kiểu dữ liệu, không còn là quyền cho phép mọi phép tính.

## Cách sử dụng

1. Mở Dataset mới hoặc đã lưu. Trong bảng cấu hình cột, chọn vai trò Định danh / Phân nhóm / Đo lường.
2. Vai trò Phân nhóm tự dùng COUNT/COUNT DISTINCT, ẩn hai ô phép tính. Chỉ Đo lường có ô phép tính cho phép; phép mặc định chỉ hiện nếu có ít nhất hai phép.
3. Lưu dataset. Chọn cột dùng để tính trước trong Chart Builder; danh sách phép tính sẽ theo cấu hình cột.

Định danh chỉ cho COUNT hoặc không phép tính. Đo lường yêu cầu cột số. Phân nhóm chỉ dùng COUNT/COUNT DISTINCT; Đo lường vẫn có thể dùng làm cột chia nhóm. Phép mặc định phải thuộc danh sách cho phép; để trống sẽ dùng lựa chọn đầu tiên khi tạo biểu đồ mới.

Mặc định theo kiểu SQL: số → vai trò Đo lường, COUNT/SUM/AVG/MIN/MAX, mặc định AVG; loại khác → Phân nhóm, COUNT/COUNT DISTINCT. Đây chỉ là gợi ý kỹ thuật: người tạo dataset xác nhận ý nghĩa; không suy đoán lĩnh vực theo tên cột. Ví dụ mã khách hàng số cần đổi thành Định danh; doanh thu nên chọn mặc định SUM.

## API và kiểm tra

POST /api/datasets và PATCH /api/datasets/{id} nhận thêm trường tùy chọn `columnSettings`, ánh xạ tên cột gốc tới cấu hình:

```json
{
  "columnSettings": {
    "customer_id": {"role":"IDENTIFIER","allowedAggregations":["COUNT"],"defaultAggregation":"COUNT"},
    "revenue": {"role":"MEASURE","allowedAggregations":["COUNT","SUM","AVG"],"defaultAggregation":"SUM"}
  }
}
```

Backend từ chối tên cột lạ, vai trò lạ, phép tính sai kiểu, giá trị trùng và phép mặc định ngoài danh sách. Chart Builder không thay thế kiểm tra backend: lưu/xem trước biểu đồ và truy vấn dashboard đều kiểm tra danh sách cho phép cùng kiểu dữ liệu hiện tại từ nguồn.

Dataset cũ được backfill theo canAggregate để giữ biểu đồ cũ. Nếu muốn bỏ phép tính mà biểu đồ đã lưu đang dùng, API trả 409 AGGREGATION_IN_USE; sửa/xóa biểu đồ đó trước. Cập nhật tên, nhãn và chính sách là một transaction. Dữ liệu nguồn không thay đổi. Các thay đổi cấu hình chưa lưu chỉ là bản nháp.

V8 tạo bảng mới bằng CREATE và REFERENCES, không cần thêm quyền ALTER. Khởi động lại backend để nhận code và migration mới. Các chỉ số có công thức sẵn, MIN/MAX ngày giờ và AI vẫn ngoài phạm vi lần này.

Kiểm chứng: unit test policy và compiler, lưu/mở lại bằng H2, bảo vệ biểu đồ đang dùng, migration MySQL thật, Vitest, browser test column-policies.spec.ts dùng API giả lập. Không tạo dữ liệu bán hàng trong database nguồn.

V9 giữ tương thích biểu đồ đã lưu: các cột Phân nhóm cũ có phép tính số được chuyển thành Đo lường; những cột Phân nhóm còn lại tự có COUNT/COUNT DISTINCT. COUNT DISTINCT đếm giá trị khác nhau và bỏ qua NULL; backend biên dịch thành COUNT(DISTINCT cột). Tên hiển thị và tên gốc đã gộp cùng một ô.
