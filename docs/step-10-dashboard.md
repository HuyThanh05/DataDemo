# Bước 10 — Dashboard

Trạng thái: **đã nghiệm thu toàn luồng với hai biểu đồ demo trên frontend/backend/MySQL thật**. Xem [biên bản nghiệm thu](acceptance/step-10-acceptance.md) và dashboard ID 5 đã lưu trong ứng dụng.

## Quy tắc đã thống nhất

- Bộ lọc chung kết hợp bộ lọc riêng bằng AND.
- Tất cả nghĩa là không thêm điều kiện của dashboard, vẫn giữ bộ lọc riêng.
- Hai biểu đồ demo không cố định môn riêng để môn học do dashboard quyết định.
- Bộ lọc chung chỉ áp dụng cho các biểu đồ cùng dataset được chọn làm nguồn lọc.
- Một dashboard demo là đủ; không chia sẻ công khai, embed hoặc phân quyền trong PoC.

## Phần 1 — tạo, đặt tên và mở lại (đã triển khai)

Frontend mở /dashboards từ menu Dashboard. Cho phép tạo mới, nhập tên, lưu, xem danh sách, mở lại và đổi tên cùng bản ghi. URL /dashboards?dashboardId=... khôi phục dashboard sau khi tải lại. Tên bắt buộc 1–100 ký tự, trim ở backend; lỗi API và mã không hợp lệ có thông báo.

Flyway V4 tạo bảng dashboards trong datademo_app, lưu id, name, created_at, updated_at. Không thay đổi bảng biểu đồ hoặc dữ liệu nguồn.

| API | Mục đích |
| --- | --- |
| GET /api/dashboards | Danh sách dashboard |
| POST /api/dashboards | Tạo mới với name, trả 201 |
| GET /api/dashboards/{id} | Mở dashboard |
| PATCH /api/dashboards/{id} | Đổi tên với name |

Review: khởi động lại backend, mở Dashboard, nhập tên và Lưu dashboard. Tải lại trang, kiểm tra tên còn nguyên. Đổi tên rồi lưu, mở từ danh sách để kiểm tra. Dashboard mới tạo chưa có biểu đồ.

## Các phần tiếp theo

2. Thêm/gỡ biểu đồ đã lưu (đã triển khai bên dưới).
3. Kéo thả và đổi kích thước bằng React Grid Layout (đã triển khai bên dưới).
4. Bộ lọc chung theo môn học, cập nhật dữ liệu thật của các biểu đồ cùng dataset theo quy tắc AND (đã triển khai bên dưới).
5. Lưu/mở danh sách biểu đồ, bố cục và cấu hình bộ lọc.
6. Nghiệm thu toàn luồng với phổ điểm và số bài thi theo khoảng điểm.

Kiểm thử phần 1: API với H2 kiểm tra lưu/mở/sửa, tên trống/quá dài và mã không tồn tại. Tích hợp MySQL tạo bản ghi riêng, mở lại bằng repository mới, đổi tên và dọn đúng ID do kiểm thử tạo; đối chiếu dữ liệu dashboard và biểu đồ cũ. React kiểm tra tạo/mở/sửa và đường dẫn không hợp lệ.

## Phần 2 — thêm/gỡ biểu đồ đã lưu (đã triển khai)

- Lưu hoặc mở dashboard trước; chọn biểu đồ đã lưu trong danh sách rồi bấm Thêm biểu đồ.
- Mỗi biểu đồ chỉ được thêm một lần trong một dashboard; có thể dùng cùng biểu đồ cho nhiều dashboard.
- Thêm/gỡ lưu ngay, tải lại trang vẫn giữ danh sách. Không cần bấm Lưu dashboard thêm lần nữa; nút đó lưu tên dashboard.
- Gỡ chỉ xóa quan hệ dashboard–biểu đồ. Cấu hình biểu đồ, dataset và dữ liệu nguồn giữ nguyên; có thể thêm lại biểu đồ.
- Các thẻ tự đọc dữ liệu thật qua API preview và vẽ ECharts, dùng tên cột thân thiện trong dataset; có nút làm mới dữ liệu và mở biểu đồ trong Chart Builder. Lỗi một nguồn/cấu hình hiển thị riêng trong thẻ.
- Các thẻ được bố trí bằng React Grid Layout như phần 3; bộ lọc chung ở phần 4.

Flyway V5 tạo dashboard_charts: dashboard_id, chart_id, added_at; khóa chính kép chống trùng và khóa ngoại tới dashboards/charts. Không sao chép cấu hình biểu đồ. Thêm/gỡ dùng transaction và khóa hàng dashboard để cập nhật quan hệ nhất quán.

| API | Mục đích |
| --- | --- |
| GET /api/dashboards/{id}/charts | Danh sách biểu đồ trên dashboard |
| POST /api/dashboards/{id}/charts | Thêm chartId; gọi lại không tạo bản trùng |
| DELETE /api/dashboards/{id}/charts/{chartId} | Gỡ quan hệ; biểu đồ đã gỡ thì không thay đổi gì |

Review: mở dashboard đã lưu → chọn biểu đồ → Thêm biểu đồ → đợi dữ liệu xuất hiện → tải lại trang. Bấm Gỡ và kiểm tra biểu đồ vẫn có trong Chart Builder/danh sách để thêm lại. Thử cùng biểu đồ trên dashboard khác, gỡ khỏi dashboard này không ảnh hưởng dashboard kia.

Kiểm chứng: API/H2 kiểm tra thêm trùng, mở bằng repository mới, dashboard riêng biệt, chartId/dashboardId không tồn tại, gỡ và thêm lại giữ nguyên biểu đồ gốc. MySQL/HTTP kiểm tra tương tự và đối chiếu dữ liệu/cấu hình cũ trước/sau khi dọn ID kiểm thử. React kiểm tra lưu/mở/gỡ/thêm lại, tải dữ liệu và lỗi thêm. Chrome kiểm tra thẻ ECharts vẽ thật, reload và gỡ/thêm lại với API phản hồi giả lập; backend thật được kiểm chứng riêng bằng MySQL.

## Phần 3 — kéo thả, đổi kích thước và lưu bố cục (đã triển khai)

- Sử dụng React Grid Layout 2.3, lưới 12 cột; kéo tiêu đề có dấu ⠿ để di chuyển, kéo góc dưới bên phải để thay đổi kích thước. Nút, liên kết và vùng biểu đồ không dùng để kéo thẻ.
- Không cho chồng lấn. Chiều rộng 4–12 ô, chiều cao 8–40 hàng; chiều cao một hàng 32 px và khoảng cách 16 px. Mặc định mỗi biểu đồ rộng 6, cao 12.
- Thay đổi giữ ở bản nháp; bấm Lưu bố cục để ghi server. Hủy thay đổi quay về bản đã lưu. Khi có bản nháp, thêm/gỡ tạm khóa để tránh làm mất sắp xếp chưa lưu.
- ECharts tự điều chỉnh theo kích thước thẻ. Mobile (container dưới 700 px) hiển thị một cột theo thứ tự bố cục desktop, không tự ghi đè vị trí/kích thước desktop.
- Biểu đồ cũ chưa có tọa độ nhận bố cục mặc định. Biểu đồ mới nằm dưới phần đã lưu, giữ nguyên vị trí các biểu đồ cũ. Gỡ biểu đồ chỉ dọn bố cục của liên kết đó, không ảnh hưởng thẻ còn lại/dashboard khác/biểu đồ gốc.

Flyway V6 tạo dashboard_chart_layouts với khóa chính dashboard_id/chart_id, grid_x/grid_y/grid_w/grid_h và khóa ngoại kép tới dashboard_charts. ON DELETE CASCADE chỉ dọn bản ghi bố cục khi gỡ liên kết. Chỉ tạo bảng mới, dùng quyền ứng dụng hiện có.

| API | Mục đích |
| --- | --- |
| GET /api/dashboards/{id}/layout | Tọa độ/kích thước, gồm mặc định cho biểu đồ chưa có bố cục |
| PUT /api/dashboards/{id}/layout | Lưu toàn bộ danh sách items: chartId, x, y, w, h |

Backend kiểm tra số nguyên, giới hạn lưới, trùng ID, chồng lấn và đúng toàn bộ chartId thuộc dashboard. Ghi trong transaction, khóa hàng dashboard để không ghi đè thay đổi danh sách đồng thời. Nếu danh sách khác trả 409, người dùng tải lại dashboard; không ghi một phần.

Review: mở dashboard đã có biểu đồ trên cửa sổ đủ rộng → kéo tiêu đề → đổi kích thước ở góc dưới phải → Lưu bố cục → tải lại trang. Thử Hủy thay đổi, thêm/gỡ sau khi lưu và thu nhỏ cửa sổ để kiểm tra bố cục desktop vẫn được giữ.

Kiểm thử: API/H2 kiểm tra lưu/mở, overlap/bounds/duplicate, từ chối thiếu ID, giữ bố cục cũ khi lỗi và giữ bố cục dashboard khác. MySQL/HTTP lưu rồi đọc lại tọa độ/kích thước, dọn bản ghi riêng và so sánh cấu hình/dữ liệu cũ. React kiểm tra lưu lỗi giữ draft, retry và mở lại, mobile không ghi server. Chrome dùng chuột kéo/resize thực tế, save/reload và chuyển mobile với API giả lập; MySQL thật kiểm chứng riêng.

## Phần 4 — bộ lọc chung theo môn học (đã triển khai)

- Chọn dataset đang dùng trên dashboard, cột Môn học theo metadata và một giá trị lấy từ nguồn thật. Backend không cố định tên trường subject_name nên có thể cấu hình dataset khác.
- Bấm Áp dụng bộ lọc để lưu cấu hình và cập nhật biểu đồ. Các lựa chọn chưa áp dụng không làm thay đổi kết quả đang hiển thị.
- Chỉ biểu đồ cùng dataset được lọc và truy vấn lại. Biểu đồ thuộc dataset khác giữ nguyên dữ liệu. Phạm vi tính theo dataset ID, kể cả hai dataset tham chiếu cùng bảng nguồn.
- Backend nối điều kiện EQ của bộ lọc chung với bộ lọc riêng bằng AND. Biểu đồ có môn riêng khác môn chung có thể rỗng; giao diện thông báo không có dữ liệu.
- Tất cả nghĩa là không thêm điều kiện chung, vẫn giữ các điều kiện riêng. Tắt bộ lọc chung xóa cấu hình chung và khôi phục cách truy vấn riêng của từng biểu đồ.
- Lưu nguồn/cột/giá trị trong datademo_app.dashboard_filters, Flyway V7. Tải lại trang khôi phục lựa chọn; không sửa cấu hình biểu đồ gốc, dữ liệu nguồn hoặc bố cục.
- Giá trị lọc được bind vào truy vấn SQL. Danh sách giá trị DISTINCT đọc từ toàn bộ nguồn, tối đa 1000 giá trị (không lấy từ 100 dòng sample); bỏ NULL, trống và giá trị dài trên 500 ký tự, có cảnh báo giới hạn.
- Nếu nguồn/cột không còn hợp lệ, có thông báo lỗi. Nếu không đọc được cấu hình bộ lọc, tạm dừng truy vấn biểu đồ để không hiển thị dữ liệu chưa lọc dưới một lựa chọn chưa biết.

| API | Mục đích |
| --- | --- |
| GET /api/dashboards/{id}/filter | Đọc bộ lọc chung; chưa cấu hình trả datasetId/column/value null |
| PUT /api/dashboards/{id}/filter | Lưu datasetId, column, value; value null = Tất cả, cả ba null = tắt |
| GET /api/dashboards/{id}/filter-values?datasetId=...&column=... | Danh sách giá trị khác nhau từ nguồn |
| GET /api/dashboards/{id}/charts/{chartId}/preview | Truy vấn biểu đồ thuộc dashboard với bộ lọc chung đã lưu |

Backend xác minh biểu đồ thuộc dashboard, dataset thuộc các biểu đồ trên dashboard và cột được phép lọc/còn tồn tại. Cho phép 10 bộ lọc riêng và thêm 1 điều kiện chung nội bộ; giới hạn builder vẫn 10. Ghi bộ lọc trong transaction và kiểm tra lại membership dưới khóa dashboard.

Review: tạo hai biểu đồ từ cùng dataset, không cố định môn riêng → thêm vào dashboard → chọn dataset, cột Môn học và môn Toán → Áp dụng bộ lọc. Cả hai cùng cập nhật; tải lại trang vẫn giữ lựa chọn. Chọn Tất cả rồi áp dụng, thử thêm một biểu đồ dataset khác để kiểm tra không bị ảnh hưởng.

Kiểm chứng: unit backend kiểm tra scope, giữ nguyên điều kiện riêng và giới hạn 10+1. H2 kiểm tra lưu/mở/reset cấu hình độc lập giữa dashboard. MySQL/HTTP đối chiếu SQL độc lập với bộ lọc môn + score>=5 và Tất cả, đối chiếu cấu hình biểu đồ/bố cục trước sau. React kiểm tra hai biểu đồ cùng nguồn cập nhật, khác dataset không bị truy vấn lại, xung đột AND, lỗi lưu giữ lựa chọn cũ và mở lại. Chrome kiểm tra chọn môn, hai canvas, reload và Tất cả bằng phản hồi API giả lập.
