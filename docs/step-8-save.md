# Bước 8 — Lưu và mở lại dataset

## Kết quả

- Chọn kết nối MySQL và bảng nguồn, đặt tên dataset, xem tối đa 100 dòng mẫu.
- Đặt tên hiển thị cho từng cột; tên cột vật lý không thay đổi.
- Lưu cấu hình trong `datademo_app.datasets` và `dataset_columns` bằng một transaction.
- Danh sách dataset đã lưu có nút Mở. Tải lại trình duyệt vẫn lấy cấu hình từ backend.
- Dataset đã lưu được sửa tên và nhãn cột. Nguồn được cố định; chọn Dataset mới để dùng bảng khác.
- Không sao chép dữ liệu nguồn. Preview đọc bảng nguồn bằng kết nối đã lưu.

## API

| Method | Đường dẫn | Mục đích |
| --- | --- | --- |
| GET | `/api/datasets` | Danh sách dataset |
| POST | `/api/datasets` | Tạo dataset: name, connectionId, tableName, columnLabels |
| GET | `/api/datasets/{id}` | Chi tiết và metadata cột đã lưu |
| PATCH | `/api/datasets/{id}` | Sửa name, columnLabels |
| GET | `/api/datasets/{id}/preview` | Xem dữ liệu nguồn của dataset đã lưu |
| POST | `/api/datasets/preview` | Xem trước khi lưu: connectionId, tableName |

Backend lấy kiểu dữ liệu từ metadata MySQL, kiểm tra bảng/cột hợp lệ và giới hạn tên/nhãn 100 ký tự. Các cột số có canAggregate; metadata canGroup/canFilter được lưu để phục vụ Chart Builder. Chưa xây truy vấn biểu đồ hoặc công thức metric trong bước này.

## Database

Flyway V2 tạo hai bảng cấu hình và khóa ngoại tới kết nối. Tài khoản ứng dụng cần REFERENCES trong datademo_app (script setup-step-8.sql). Không cấp thêm quyền cho tài khoản reader. Không chỉnh sửa migration V2 sau khi đã áp dụng.

## Người dùng kiểm tra

1. Khởi động lại backend để dùng API mới; chạy frontend bằng npm run dev.
2. Mở Dataset, chọn kết nối và exam_scores.
3. Đặt tên dataset và tên hiển thị cho các cột, bấm Lưu dataset.
4. Trong danh sách đã lưu, bấm Mở rồi tải lại trang; kiểm tra tên và nhãn vẫn còn.
5. Sửa tên hoặc nhãn, bấm Lưu dataset để cập nhật.

## Kiểm chứng

Kiểm thử service kiểm tra metadata, tên và nhãn; kiểm thử H2 kiểm tra transaction/rollback và khóa ngoại. Kiểm thử tích hợp MySQL kiểm tra migration V2, tạo/list/mở/preview/cập nhật dataset, từ chối cột lạ, đối chiếu dữ liệu nguồn và cấu hình cũ. Dữ liệu do kiểm thử tạo được dọn theo ID của chính nó.
