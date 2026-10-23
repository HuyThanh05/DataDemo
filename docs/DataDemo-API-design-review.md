# Thiết kế API PoC DataDemo

Trạng thái: bản đề xuất để review, chưa triển khai.

Backend: Java + Spring Boot. Database nguồn: MySQL.
Tiền tố API: `/api`.

Backend xử lý theo metadata và cấu hình dataset, không viết cố định tên bảng/cột điểm thi.

## 1. Kết nối database

| Method | API | Chức năng |
|---|---|---|
| POST | /api/connections/test | Kiểm tra thông tin kết nối trước khi lưu |
| POST | /api/connections | Lưu kết nối |
| GET | /api/connections | Danh sách kết nối |
| GET | /api/connections/{id} | Chi tiết kết nối, không trả mật khẩu |
| POST | /api/connections/{id}/test | Kiểm tra kết nối đã lưu |
| GET | /api/connections/{id}/tables | Danh sách bảng nguồn |
| GET | /api/connections/{id}/columns?table=exam_scores | Danh sách cột và kiểu dữ liệu |

Ví dụ request kiểm tra hoặc tạo kết nối:

```json
{
  "name": "Dữ liệu demo",
  "host": "localhost",
  "port": 3306,
  "databaseName": "datademo_source",
  "username": "datademo_reader",
  "password": "..."
}
```

PoC chỉ hỗ trợ MySQL; chưa làm sửa/xóa kết nối trên giao diện.

## 2. Dataset

| Method | API | Chức năng |
|---|---|---|
| POST | /api/datasets | Tạo dataset từ bảng nguồn |
| GET | /api/datasets | Danh sách dataset |
| GET | /api/datasets/{id} | Chi tiết, metadata và tên hiển thị cột |
| PATCH | /api/datasets/{id} | Sửa tên dataset và tên hiển thị cột |
| GET | /api/datasets/{id}/preview | Xem trước tối đa 100 dòng |
| GET | /api/datasets/{id}/columns/{columnId}/values | Lấy các giá trị khác nhau cho bộ lọc |

Ví dụ tạo dataset:

```json
{
  "name": "Điểm thi Đà Nẵng 2026",
  "connectionId": 1,
  "tableName": "exam_scores"
}
```

Backend tự đọc và lưu metadata các cột. API lấy giá trị bộ lọc trả tối đa 100 giá trị, cùng cờ `truncated` nếu còn dữ liệu. Dataset chỉ tham chiếu một bảng vật lý, chưa hỗ trợ JOIN hoặc SQL tùy ý.

## 3. Chart Builder

| Method | API | Chức năng |
|---|---|---|
| POST | /api/charts/preview | Chạy cấu hình, trả kết quả, chưa lưu |
| POST | /api/charts | Lưu biểu đồ mới |
| GET | /api/charts | Danh sách biểu đồ đã lưu |
| GET | /api/charts/{id} | Chi tiết cấu hình |
| PUT | /api/charts/{id} | Cập nhật biểu đồ |
| POST | /api/charts/{id}/data | Truy vấn dữ liệu cho biểu đồ đã lưu |

Ví dụ cấu hình xem trước hoặc lưu:

```json
{
  "name": "Phổ điểm Toán",
  "datasetId": 1,
  "chartType": "BAR",
  "dimension": "score",
  "metric": {
    "aggregation": "COUNT",
    "column": "score"
  },
  "filters": [
    {
      "column": "subject_name",
      "operator": "EQ",
      "value": "Toán"
    }
  ],
  "sortDirection": "ASC"
}
```

Quy tắc:

- Một dimension và một metric mỗi biểu đồ.
- Loại biểu đồ: `BAR`, `LINE`.
- Tổng hợp: `SUM`, `AVG`, `COUNT`; SUM/AVG chỉ áp dụng cho cột kiểu số.
- COUNT(cột) đếm giá trị khác NULL, không mặc định là số thí sinh.
- Bộ lọc: `EQ`; nhiều điều kiện kết hợp bằng AND.
- Sắp xếp theo dimension: ASC hoặc DESC.
- Tên cột gửi lên là tên cột nguồn; tên hiển thị chỉ dùng trên giao diện.
- Backend kiểm tra cột, kiểu dữ liệu và phép tổng hợp theo metadata trước khi tạo SQL.
- Giá trị lọc được truyền bằng tham số; không nhận SQL tùy ý.
- Kết quả biểu đồ tối đa 1.000 nhóm; vượt giới hạn thì yêu cầu thu hẹp cấu hình.
- Thời gian chờ truy vấn đề xuất: 10 giây.

Ví dụ response dữ liệu chung cho cột/đường (số liệu minh họa):

```json
{
  "dimensionLabel": "Điểm thi",
  "metricLabel": "Số bài có điểm",
  "rows": [
    { "dimension": 7.5, "value": 125 },
    { "dimension": 7.75, "value": 98 }
  ]
}
```

## 4. Dashboard

| Method | API | Chức năng |
|---|---|---|
| POST | /api/dashboards | Tạo dashboard |
| GET | /api/dashboards | Danh sách dashboard |
| GET | /api/dashboards/{id} | Tên, biểu đồ, bố cục và cấu hình bộ lọc |
| PUT | /api/dashboards/{id} | Lưu toàn bộ cấu hình dashboard |
| POST | /api/dashboards/{id}/data | Lấy dữ liệu các biểu đồ theo bộ lọc chung |

Thêm/gỡ biểu đồ, kéo thả, đổi kích thước và cấu hình bộ lọc được lưu chung trong một request:

```json
{
  "name": "Dashboard điểm thi",
  "items": [
    { "chartId": 1, "x": 0, "y": 0, "width": 6, "height": 4 },
    { "chartId": 2, "x": 6, "y": 0, "width": 6, "height": 4 }
  ],
  "filter": {
    "label": "Môn học",
    "datasetId": 1,
    "column": "subject_name"
  }
}
```

Quy tắc:

- Lưới desktop 12 cột.
- Một biểu đồ xuất hiện tối đa một lần trong cùng dashboard.
- Một bộ lọc chung dạng chọn một giá trị trên mỗi dashboard.
- `filter: null` để bỏ cấu hình bộ lọc.
- Gỡ chart khỏi dashboard chỉ xóa quan hệ, không xóa chart.

Khi người dùng chọn môn, gọi `POST /api/dashboards/1/data`:

```json
{
  "filterValue": "Toán"
}
```

Backend đọc cấu hình bộ lọc đã lưu, áp dụng cho chart cùng dataset và kết hợp bộ lọc riêng của từng chart bằng AND. Không gửi giá trị hoặc gửi NULL nghĩa là bỏ lọc chung. Bộ lọc không sửa cấu hình gốc của chart.

Response trả kết quả riêng theo chartId; nếu một chart lỗi, các chart khác vẫn có thể hiển thị.

## 5. Quy tắc chung và lỗi

| Trường hợp | HTTP status |
|---|---|
| Tạo tài nguyên thành công | 201 |
| Đọc/cập nhật/truy vấn thành công | 200 |
| Cấu hình không hợp lệ | 400 |
| Không tìm thấy tài nguyên | 404 |
| Xung đột với trạng thái tài nguyên | 409 |
| Kết nối hoặc truy vấn database nguồn thất bại | 502 |
| Truy vấn nguồn quá thời gian | 504 |

Định dạng lỗi thống nhất:

```json
{
  "code": "INVALID_CHART_CONFIG",
  "message": "AVG chỉ áp dụng cho cột kiểu số."
}
```

Không trả mật khẩu, stack trace hoặc thông tin kết nối nhạy cảm trong lỗi. Kết quả rỗng trả `rows: []`, không coi là lỗi. Tài khoản kết nối nguồn chỉ có quyền đọc.

PoC chưa có xác thực, phân quyền, audit log, API SQL Lab hoặc chia sẻ dashboard công khai. Các cấu trúc request/response chưa minh họa chi tiết sẽ được hoàn thiện khi triển khai, trong phạm vi đã duyệt.

## 6. Luồng gọi API khi demo

Kiểm tra/lưu kết nối → Xem bảng/cột → Tạo dataset → Xem trước dữ liệu → Xem trước và lưu chart → Tạo dashboard → Lưu bố cục/bộ lọc → Truy vấn lại khi đổi bộ lọc.

Kiểm tra thêm dataset bán hàng: chọn nhóm sản phẩm làm dimension và SUM(doanh thu) làm metric bằng cùng API, không sửa logic backend.
