# Bước 9 — Chart Builder

## Phần 1: chọn dataset (đã triển khai)

- Mở Chart Builder từ thanh điều hướng hoặc nút Tạo biểu đồ.
- Chọn dataset đã lưu; có tìm kiếm theo tên.
- Đọc danh sách và chi tiết qua API dataset hiện có, không viết cố định tên trường điểm thi.
- Hiển thị tên thân thiện, tên cột gốc, kiểu dữ liệu và khả năng nhóm/tổng hợp số/lọc từ metadata.
- Lưu lựa chọn trong URL `/charts?datasetId=...` để mở trực tiếp, tải lại và dùng lịch sử trình duyệt.
- Có trạng thái đang tải, chưa có dataset, lỗi API và thử lại. Chuyển dataset không giữ cột của dataset trước.

Review: chạy backend và frontend, vào Chart Builder, chọn dataset đã lưu ở bước 8; kiểm tra tên hiển thị đúng. Nếu chưa có dataset, lưu một dataset trước. Tải lại trang để kiểm tra lựa chọn được khôi phục.

## Phần 2: cấu hình biểu đồ (đã triển khai)

- Chọn biểu đồ cột hoặc đường.
- Dimension lấy từ các cột canGroup; các lựa chọn hiển thị nhãn thân thiện, giá trị bên trong dùng tên cột gốc.
- AVG chỉ chọn cột số canAggregate. COUNT chọn được mọi cột và có nghĩa COUNT(cột): bỏ NULL, vẫn đếm giá trị 0.
- Chuyển COUNT sang AVG tự bỏ lựa chọn metric nếu cột không phù hợp.
- Chuyển dataset khởi tạo bản nháp mới; không mang cấu hình cột từ dataset cũ.
- Hiển thị tóm tắt khi đã chọn đủ dimension và metric. Tải lại trang chỉ khôi phục dataset đã chọn; cấu hình biểu đồ chưa được lưu.

Review: mở Chart Builder, chọn dataset; thử dimension Môn học, AVG Điểm thi, rồi COUNT. Kiểm tra COUNT chọn được cột chữ, AVG chỉ chọn được cột số. Đổi loại biểu đồ để kiểm tra tóm tắt.

## Trạng thái

Đã triển khai phạm vi Chart Builder của bước 9: chọn dataset, cấu hình cột/đường, AVG/COUNT, bộ lọc AND, sắp xếp, nhóm số theo khoảng, truy vấn/xem trước, đặt tên và lưu/mở/sửa biểu đồ. Gắn biểu đồ vào dashboard thuộc bước tiếp theo.

Phần 1 chỉ đọc metadata đã lưu, chưa tạo hoặc lưu biểu đồ.

## Phần 3a: cấu hình bộ lọc (đã triển khai)

- Thêm/xóa tối đa 10 điều kiện; kết hợp bằng AND, lọc trên từng dòng trước tổng hợp.
- Chỉ chọn cột có canFilter, hiển thị tên thân thiện và giữ tên cột gốc trong bản nháp.
- Mọi cột hỗ trợ bằng/khác, IS NULL/IS NOT NULL. Cột số thêm >, >=, <, <=.
- Điều kiện NULL không cần giá trị. Chuỗi nhập “NULL” ở điều kiện bằng là chuỗi văn bản, không phải SQL NULL.
- Cột số yêu cầu số hữu hạn dùng dấu chấm thập phân; 0 hợp lệ. Giá trị trống không hợp lệ với phép so sánh.
- Đổi cột đặt lại điều kiện về bằng và xóa giá trị cũ; đổi dataset xóa toàn bộ bản nháp.
- Hiện thông báo khi bộ lọc chưa hợp lệ và tóm tắt khi hợp lệ. Khi bấm Xem trước, bộ lọc được kiểm tra lại ở backend và áp dụng trên nguồn. Không thay đổi dữ liệu hoặc lưu biểu đồ.

Review: thêm bộ lọc Môn học bằng tên môn đúng trong nguồn; thêm Điểm thi lớn hơn hoặc bằng 5. Thử nhập chữ vào điều kiện điểm, chuyển sang IS NULL, đổi cột và xóa điều kiện.

## Phần 3b và 4: sắp xếp và xem trước (đã triển khai)

- Chọn ASC/DESC cho dimension, sắp xếp theo kiểu dữ liệu và collation của MySQL, trước khi giới hạn số nhóm. NULL dùng quy tắc sắp xếp của MySQL.
- POST `/api/charts/preview` nhận datasetId, chartType (bar/line), dimension, aggregation (AVG/COUNT), metricColumn, sortDirection (ASC/DESC), filters (column/operator/value).
- Backend đọc dataset đã lưu, đối chiếu cột/kiểu dữ liệu hiện tại và khả năng canGroup/canAggregate/canFilter; không nhận SQL từ frontend.
- Query compiler chỉ cho phép toán tử/direction/aggregation hợp lệ; identifier thuộc metadata được quote, giá trị lọc được bind bằng PreparedStatement.
- Truy vấn nguồn bằng credential đã mã hóa của kết nối, chế độ chỉ đọc, timeout 10 giây. GROUP BY tính trên toàn bộ dữ liệu phù hợp, không dùng giới hạn 100 dòng preview dataset.
- Trả rows (dimension/value), truncated, limit và durationMs; giá trị tổng hợp trả dạng chuỗi để giữ độ chính xác. Tối đa 1000 nhóm, đọc thêm nhóm thứ 1001 để phát hiện cắt bớt và hiện cảnh báo.
- Frontend bấm Xem trước để truy vấn và vẽ bằng ECharts, kèm bảng kết quả; NULL không biến thành 0. Tooltip dùng richText. Thay cấu hình xóa kết quả cũ; nguồn lỗi hoặc không có dòng có thông báo riêng.
- Backend không phụ thuộc tên cột điểm thi và dùng được dataset bán hàng có kiểu dữ liệu phù hợp.

Review: khởi động lại backend, mở Chart Builder và dataset đã lưu. Chọn Môn học, AVG(Điểm thi), Giảm dần, bấm Xem trước. Thử COUNT, đổi cột/đường và bộ lọc rồi bấm lại. Để xem phổ điểm, chọn dimension Điểm thi, COUNT(Điểm thi), lọc một môn và tăng dần.

Kiểm chứng: kiểm thử compiler/H2 kiểm tra identifier, bind tham số, NULL, điểm 0, AVG/COUNT và điều kiện AND; kiểm thử tích hợp MySQL đối chiếu từng nhóm AVG/COUNT với SQL độc lập và giữ dữ liệu/cấu hình có sẵn. Kiểm thử React kiểm tra request, số 0/NULL, lỗi và retry. Kiểm thử Chrome dùng dữ liệu phản hồi mẫu để kiểm tra renderer ECharts thực tế cho cột/đường; SQL thực tế được kiểm tra riêng bằng tích hợp MySQL.

## Nhóm theo khoảng số

Chọn dimension số, Cách nhóm dimension = Theo khoảng số. Cấu hình min/max/size không phụ thuộc dữ liệu điểm thi. Mặc định 0, 10, 1, tạo [0,1), [1,2), …, [9,10]. Cận cuối được tính vào khoảng cuối, mỗi giá trị chỉ thuộc một khoảng. Chỉ xét min ≤ dimension ≤ max; loại NULL và dữ liệu ngoài đoạn. Các khoảng rỗng không được trả thành nhóm. Cấu hình có tối đa 1000 khoảng, độ rộng phải dương và chia hết đoạn.

API nhận `bucket: { min: 0, max: 10, size: 1 }`, hoặc null để nhóm theo giá trị cột. Tính toán dùng DECIMAL và FLOOR trong SQL, bind toàn bộ giá trị khoảng. Kết quả trả cận trái dạng số thập phân; frontend tạo nhãn và vẫn giữ thứ tự số của backend. Kiểm thử có điểm 0, 0.99, 1, 9.99, 10, NULL và dữ liệu ngoài đoạn.

## Lưu và mở lại biểu đồ

Flyway V3 tạo bảng charts trong datademo_app: name, dataset_id (khóa ngoại), configuration_json và timestamps. Cấu hình lưu loại biểu đồ, dimension, aggregation, metricColumn, sortDirection, filters và bucket. Không lưu bản sao dữ liệu nguồn hoặc kết quả truy vấn.

| API | Mục đích |
| --- | --- |
| GET /api/charts | Danh sách biểu đồ đã lưu |
| POST /api/charts | Tạo mới: name, configuration; trả 201 |
| GET /api/charts/{id} | Đọc cấu hình |
| PATCH /api/charts/{id} | Cập nhật tên/cấu hình |
| GET /api/charts/{id}/preview | Truy vấn theo cấu hình đã lưu |

Backend kiểm tra tên 1–100 ký tự và toàn bộ cấu hình trước khi lưu; thao tác ghi dùng transaction. Mở từ danh sách hoặc URL /charts?chartId=... khôi phục cấu hình. Xem trước truy vấn lại nguồn hiện tại. Chọn dataset khác hoặc Biểu đồ mới để tạo cấu hình mới. Biểu đồ đã lưu có ID và dataset reference sẵn cho dashboard sử dụng ở bước sau.

Review nghiệm thu:

1. Phổ điểm: chọn dataset điểm thi, Cột, dimension Điểm thi, Theo giá trị, COUNT(Điểm thi), tăng dần; thêm Môn học bằng một môn có trong nguồn. Xem trước, nhập tên, Lưu biểu đồ.
2. Số bài theo khoảng: chọn Biểu đồ mới, dataset điểm thi, Đường, dimension Điểm thi, Theo khoảng số (0–10, rộng 1), COUNT(Điểm thi); lọc một môn. Xem trước, đặt tên và lưu.
3. Trong danh sách bấm Mở biểu đồ, tải lại trang: tên, loại, dimension, metric, bộ lọc, thứ tự và khoảng được giữ. Đổi tên/cấu hình rồi lưu để cập nhật cùng ID.

Kiểm thử lưu trữ H2 kiểm tra mở bằng repository mới, cập nhật cùng bản ghi và khóa ngoại. Kiểm thử MySQL tạo/lưu/mở/sửa/preview biểu đồ khoảng, đối chiếu SQL độc lập, dọn đúng các ID do kiểm thử tạo và so sánh cấu hình/dữ liệu cũ. Chrome kiểm tra lưu rồi reload với API giả lập để tách kiểm chứng giao diện khỏi kiểm chứng MySQL.
