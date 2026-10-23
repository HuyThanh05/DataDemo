# Demo giao diện DataDemo

Mở `index.html` bằng Chrome hoặc Edge. Không cần cài thư viện hoặc chạy backend.

Đây là bản demo riêng để duyệt giao diện, chưa phải project React/Spring Boot. Style và bố cục theo bốn ảnh tham khảo đã thống nhất. Không bao gồm thanh công cụ Export/Fill/Fit của công cụ xem ảnh.

## Cách thử

1. Kết nối: thử kiểm tra, lưu thông tin giả lập; nhập host `error` để thử lỗi. Mật khẩu không được lưu.
2. Chọn bảng `diem_thi` hoặc `ban_hang`, nhấn Tạo dataset từ bảng này.
3. Dataset: sửa tên hiển thị, xem trước, lưu dataset.
4. Chart Builder: chọn dataset, loại cột/đường, dimension, SUM/AVG/COUNT, sắp xếp và điều kiện bằng. Xem trước, lưu hoặc mở lại để sửa.
5. Dashboard: thêm/gỡ biểu đồ, chọn môn học để lọc dataset điểm thi, kéo tiêu đề để đổi thứ tự, kéo góc dưới phải để đổi kích thước. Nhấn Lưu bố cục.
6. Tải lại trang để xem cấu hình đã lưu; nút Đặt lại demo khôi phục ban đầu.

## Giới hạn

- Metadata và dữ liệu đều giả lập; không đọc file điểm thi thực tế, không kết nối MySQL/API.
- Biểu đồ được tổng hợp thật trên tập dữ liệu minh họa nhỏ trong trình duyệt.
- Dữ liệu và cấu hình lưu bằng localStorage nếu trình duyệt cho phép; chỉ có hiệu lực trên trình duyệt và đường dẫn này.
- Bộ lọc chung demo cố định cấu hình cột môn học; giao diện cấu hình bộ lọc tổng quát sẽ được hoàn thiện khi triển khai.
- Kéo thả thay đổi thứ tự bằng HTML drag/drop, đổi kích thước bằng CSS resize; chưa dùng React Grid Layout hay ECharts.
- Thông tin kết nối mẫu chỉ dùng để minh họa. Không nhập thông tin xác thực thật.
