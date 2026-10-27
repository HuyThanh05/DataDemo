# Bổ sung biểu đồ tròn và bảng

Chart Builder hỗ trợ bốn lựa chọn: **Cột**, **Đường**, **Tròn (Pie)** và **Bảng (Table)**. Hai loại mới dùng cùng dataset, cột chia nhóm, AVG/COUNT, bộ lọc, thứ tự và cấu hình khoảng số như các biểu đồ hiện có.

## Cách dùng

1. Khởi động lại backend để nhận hai loại cấu hình mới; tải lại frontend.
2. Vào Chart Builder, chọn dataset và loại **Tròn (Pie)** hoặc **Bảng (Table)**.
3. Chọn cột chia nhóm, cột dùng để tính và cách tính; bấm Xem trước.
4. Đặt tên và Lưu biểu đồ để mở lại hoặc thêm vào Dashboard.

Ví dụ: nhóm theo Môn học, COUNT trên Điểm thi. Biểu đồ tròn thể hiện tỷ trọng số bài có điểm theo môn; bảng hiển thị số bài của từng môn. Đây là số bài có điểm, không phải số thí sinh duy nhất.

## Hiển thị

- Tròn: vẽ bằng ECharts, có tooltip tên/giá trị/tỷ lệ. Chú giải HTML bên dưới giữ đầy đủ tên nhóm dài; nhiều nhóm sẽ không ép tất cả tên lên các đường dẫn quanh hình tròn.
- Tỷ lệ tính trên tổng các giá trị đã nhóm và tổng hợp. Với AVG, tỷ lệ là tỷ lệ giữa các giá trị trung bình, không phải tỷ lệ số bài.
- Kết quả NULL không tạo phần trong hình tròn và có chú thích rõ; giá trị 0 vẫn giữ trong chú giải. Nếu tất cả giá trị bằng 0 hoặc NULL, hiện thông báo thay vì tạo các phần bằng nhau.
- Giá trị âm không được dùng để vẽ tỷ trọng; hiện thông báo và vẫn giữ bảng kết quả ở Chart Builder.
- Bảng: hiển thị hai cột gồm giá trị nhóm và kết quả tính; có phân trang 10 nhóm/trang. Giá trị được giữ dưới dạng chuỗi chính xác, phân biệt 0 và NULL.
- Trên Dashboard, loại Bảng luôn hiển thị bảng, dù bảng số liệu phụ của các loại biểu đồ khác được ẩn. Hai loại mới vẫn dùng bộ lọc chung, lưu/mở lại, thêm/gỡ và bố cục dashboard.

## Backend và lưu trữ

API cấu hình chấp nhận `chartType: "pie"` và `chartType: "table"`. Cấu trúc request/response, AVG/COUNT và SQL tổng hợp giữ nguyên; backend tiếp tục kiểm tra metadata và bind giá trị lọc. Cấu hình được lưu trong JSON hiện có, không cần migration hoặc chạy SQL bổ sung.

## Kiểm chứng

- Compiler: cả bốn loại tạo cùng truy vấn tổng hợp hợp lệ; loại chưa hỗ trợ và AVG trên cột chữ bị từ chối.
- Lưu trữ: pie/table mở lại đúng loại, giữ bộ lọc và cấu hình khoảng.
- React: kiểm tra tỷ trọng, NULL, 0, giá trị âm, bảng trên dashboard và độ chính xác số lớn.
- Chrome: `chart-types.spec.ts` kiểm tra tạo/xem trước/lưu/mở lại hai loại, thêm cả hai vào dashboard, lọc chung và tải lại trang.
- MySQL thật: `ChartTypesMySqlIT` tạo các cấu hình riêng, đối chiếu truy vấn với SQL độc lập, kiểm tra lọc theo môn, dọn đúng ID kiểm thử và đối chiếu cấu hình có trước/dữ liệu tổng hợp nguồn.
