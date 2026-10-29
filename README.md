# DataDemo

PoC khai thác và trực quan hóa dữ liệu, tập trung vào luồng làm việc của **Analyst**:

**Kết nối MySQL → Dataset → Biểu đồ → Dashboard → Lọc dữ liệu.**

## Chức năng

- Kiểm tra, lưu kết nối MySQL và đọc bảng/cột.
- Tạo dataset, xem trước, đặt nhãn cột và cấu hình vai trò/phép tính cho từng cột.
- Tạo biểu đồ cột, đường, tròn và bảng với AVG/COUNT/SUM/MIN/MAX, chia nhóm và bộ lọc.
- Thêm/gỡ biểu đồ, kéo thả, đổi kích thước và lọc chung trên dashboard.
- Lưu, mở lại và xóa cấu hình; chặn xóa khi còn phụ thuộc.

## Công nghệ

| Backend | Frontend | Database |
| --- | --- | --- |
| Java 21, Spring Boot, JDBC, Flyway | React, TypeScript, Vite, Ant Design, ECharts, React Grid Layout | MySQL 8 |

Backend tách controller/service/repository theo chức năng. Frontend tách các phần chức năng, layout, routing và lớp gọi API.

## Cài đặt và chạy

Yêu cầu: **JDK 21, Node.js và npm, MySQL 8**. Xem [hướng dẫn cài đặt chi tiết](docs/local-setup.md) khi chạy lần đầu.

1. Tạo `datademo_source` chứa dữ liệu phân tích và `datademo_app` lưu cấu hình ứng dụng.
2. Tạo tài khoản nguồn chỉ đọc `datademo_reader`; chạy [script tài khoản ứng dụng](scripts/setup-step-7.sql) sau khi thay mật khẩu mẫu.
3. Copy `backend/application-local.properties.example` thành `backend/application-local.properties`, điền mật khẩu `datademo_app_user`. Bỏ qua thao tác copy nếu đã có file cấu hình riêng.

Mở **hai terminal tại thư mục gốc project**:

**Backend:**

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

**Frontend:**

```powershell
cd frontend
npm ci
npm run dev
```

Mở URL Local của Vite, thường là [http://localhost:5173](http://localhost:5173). Backend chạy tại `8080`; kiểm tra bằng [API health](http://localhost:8080/api/health). Flyway tự tạo các bảng cấu hình khi backend khởi động.

## Dữ liệu và demo

Demo hiện dùng điểm thi THPT Đà Nẵng 2026: **35.526 thí sinh, 140.567 dòng điểm**, mỗi dòng là điểm một môn. CSV không có trên GitHub; cần nhận file riêng hoặc chuẩn bị bảng MySQL khác. Xem [chuẩn bị dữ liệu](docs/data-preparation.md).

Luồng demo: lưu kết nối → tạo dataset → tạo biểu đồ AVG điểm và COUNT bài thi theo môn → thêm vào dashboard → lọc Toán/Ngữ văn → tải lại trang để kiểm tra cấu hình đã lưu.

## Phạm vi PoC

- Chỉ hỗ trợ MySQL, bảng vật lý và phép tính AVG/COUNT/SUM/MIN/MAX.
- Chưa có đăng nhập/phân quyền, SQL Lab, chia sẻ/nhúng hoặc triển khai production.
- Nhãn cột và cấu hình lưu trong `datademo_app`; dữ liệu nguồn giữ nguyên.
- Không đưa mật khẩu hoặc `backend/.local/connection.key` lên Git. Giữ khóa để mở lại các kết nối đã lưu.

## Tài liệu

- [Thiết kế API](docs/DataDemo-API-design-review.md)
- [Nghiệm thu toàn luồng](docs/acceptance/step-10-acceptance.md)
- [Kịch bản demo 7–10 phút](docs/demo-poc-script.md)

- [Vai trò cột và phép tính](docs/dataset-column-policies.md)

- [Hai dataset kinh doanh: Superstore và Coffee Shop](docs/business-datasets.md)
