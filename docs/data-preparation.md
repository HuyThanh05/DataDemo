# Chuẩn bị dữ liệu demo Đà Nẵng 2026

Chạy từ thư mục project bằng Node.js, không cần cài thêm thư viện:

```powershell
node scripts/prepare-data.mjs
```

## Đầu vào và đầu ra

- Đầu vào giữ nguyên: `data/raw/diem_thi_2026_da_nang.csv`.
- Đầu ra UTF-8: `data/processed/diem_thi_2026_da_nang_long.csv`.
- Báo cáo kiểm tra: `docs/data-preparation-2026.json`.
- 35.526 thí sinh, 140.567 dòng điểm có giá trị, 17 môn sau khi tách ngoại ngữ.

## Từ điển dữ liệu

| Cột | Ý nghĩa / kiểu dự kiến khi nhập MySQL |
|---|---|
| ma_thi_sinh | Số báo danh, VARCHAR(8); không chuyển sang số |
| nam | Năm đầy đủ 2026, SMALLINT |
| ma_tinh | Mã hội đồng thi 48, CHAR(2) |
| tinh_thanh | Nhãn Đà Nẵng, VARCHAR |
| ma_mon | Mã môn ổn định, VARCHAR |
| mon_hoc | Tên môn tiếng Việt, VARCHAR |
| ma_ngoai_ngu | N1–N7 với môn ngoại ngữ; trống ở môn khác |
| diem | Điểm 0–10, DECIMAL(4,2) |

Khóa duy nhất dự kiến: (nam, ma_thi_sinh, ma_mon).

## Quy tắc

- Chuyển 12 cột điểm nguồn thành từng dòng điểm; bỏ các cột tổng điểm/khối tính sẵn.
- Tách NgoaiNgu theo MaMonNgoaiNgu; N7 là Tiếng Hàn. Không trộn điểm các ngoại ngữ thành một môn.
- Ô điểm trống không tạo dòng điểm. Không suy luận trống là vắng thi, không đăng ký hay miễn thi.
- Giữ nguyên hai điểm 0; không điền điểm thiếu và không làm tròn lại giá trị nguồn.
- Loại dòng thí sinh trùng hoàn toàn nếu có; dừng khi có bản trùng xung đột, mã sai hoặc điểm không hợp lệ. Lần chạy hiện tại không có dòng trùng.
- Giữ toàn bộ 35.526 thí sinh; không lấy mẫu. Mỗi thí sinh trong đầu vào hiện có ít nhất một điểm.
- COUNT(diem) là số bài có điểm, không phải số thí sinh.

## Đối chiếu

Script đọc lại CSV đã tuần tự hóa, đối chiếu số thí sinh, số điểm, tổng điểm theo từng môn bằng đơn vị 0,01 điểm và số điểm 0. Kiểm tra SHA-256 xác nhận file nguồn không bị sửa. Chạy lại cùng đầu vào tạo cùng CSV và mã SHA-256.

Đây là chuẩn hóa cấu trúc và kiểm tra tính nhất quán nội bộ; không chứng minh dữ liệu cộng đồng hoàn toàn khớp dữ liệu chính thức. Tình trạng cập nhật phúc khảo chưa được xác nhận. Chưa nhập MySQL ở bước này.
