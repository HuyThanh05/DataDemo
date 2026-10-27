# Kịch bản trình bày và demo PoC DataDemo

Thời lượng dự kiến: khoảng 9 phút, gồm lời nói và thao tác. Phần trong ngoặc vuông là hướng dẫn thao tác, không đọc thành lời. Các mốc thời gian là gợi ý để tập trước buổi demo.

## Chuẩn bị trước buổi demo

- Giữ MySQL, backend và frontend đang chạy; mở URL Local do Vite hiển thị.
- Dùng các cấu hình đã nghiệm thu: dataset ID 8, biểu đồ cột ID 5, biểu đồ đường ID 6, dashboard ID 5. Các tên bắt đầu bằng `NT10-a0ae048f`.
- Dashboard có hai biểu đồ cùng dataset, không đặt bộ lọc riêng theo môn. Bộ lọc chung dùng cột `subject_name`.
- Trong Chart Builder, các cấu hình thử chỉ bấm **Xem trước**. Chỉ bấm **Lưu biểu đồ** khi chủ động muốn cập nhật cấu hình đã lưu.
- Chuẩn bị Workbench với câu SQL ở cuối tài liệu để đối chiếu. Dùng cửa sổ trình duyệt đủ rộng để kéo thả và đổi kích thước dashboard.

## 1. Giới thiệu mục tiêu — 0:00 đến 0:45

[Mở màn hình Kết nối.]

“Em xin trình bày PoC DataDemo, một công cụ khai thác và trực quan hóa dữ liệu.

Mục tiêu em kiểm chứng là: từ một bảng dữ liệu trong MySQL, người dùng có thể chọn dữ liệu, cấu hình biểu đồ và tạo dashboard bằng giao diện, không cần tự viết câu SQL cho từng biểu đồ.

Luồng demo hôm nay gồm bốn phần: kết nối database, tạo dataset, cấu hình biểu đồ và tương tác trên dashboard. Em cũng sẽ kiểm tra việc lưu cấu hình để mở lại sau khi tải lại trang.”

## 2. Giới thiệu dữ liệu và cách tổ chức — 0:45 đến 1:30

[Có thể chỉ sơ đồ hai database trong Workbench rồi quay lại ứng dụng.]

“Dữ liệu demo là bộ điểm thi THPT năm 2026 của Đà Nẵng được tổng hợp từ nguồn cộng đồng. Bộ dữ liệu đã chuẩn bị có 35.526 mã thí sinh và 140.567 dòng điểm. Mỗi dòng biểu diễn điểm một môn của một thí sinh.

Dữ liệu đã được chuẩn bị và nhập vào MySQL trước buổi demo. Ứng dụng hiện đọc bảng có sẵn.

Em tách hai database: datademo_source chứa dữ liệu để phân tích; datademo_app chứa cấu hình kết nối, dataset, biểu đồ và dashboard. Tài khoản đọc nguồn chỉ có quyền SELECT, còn tài khoản ứng dụng ghi cấu hình vào database riêng.”

## 3. Kết nối database — 1:30 đến 2:20

[Chọn kết nối MySQL đã lưu → Kiểm tra lại → chọn bảng exam_scores → chỉ danh sách cột.]

“Đây là chức năng kết nối database. Em sử dụng kết nối đã lưu và kiểm tra lại để xác nhận ứng dụng đang truy cập được MySQL.

Sau khi kết nối thành công, ứng dụng đọc danh sách bảng và thông tin cột từ database. Với bảng exam_scores, giao diện hiển thị tên cột, kiểu dữ liệu và khả năng nhận giá trị NULL.

Các thông tin này được đọc từ nguồn thật để phục vụ những bước tiếp theo. Ví dụ, cột điểm là cột số nên có thể dùng để tính trung bình.

Mật khẩu kết nối được mã hóa trước khi lưu và không được trả lại khi đọc danh sách kết nối.”

## 4. Dataset: chọn dữ liệu và đặt tên dễ hiểu — 2:20 đến 3:20

[Mở Dataset → mở dataset ID 8 → chỉ bảng nguồn, tên dataset, tên hiển thị và phần xem trước.]

“Dataset là phần cấu hình giúp ứng dụng sử dụng một bảng nguồn. Tại đây, người dùng chọn kết nối, chọn bảng, đặt tên dataset và đặt tên hiển thị cho các cột.

Ví dụ, subject_name được hiển thị là Môn học, còn score được hiển thị là Điểm thi. Những tên này sẽ được dùng trong Chart Builder để người dùng dễ chọn hơn.

Việc đặt tên chỉ được lưu trong cấu hình ứng dụng; tên cột và dữ liệu trong bảng nguồn vẫn giữ nguyên.

Phần xem trước hiển thị tối đa 100 dòng để kiểm tra dữ liệu trước khi sử dụng. Giới hạn này chỉ dành cho xem mẫu. Khi tạo biểu đồ, hệ thống sẽ truy vấn toàn bộ dữ liệu phù hợp với điều kiện lọc.

Dataset đã lưu có thể mở lại và tiếp tục dùng để tạo nhiều biểu đồ.”

## 5. Chart Builder: cấu hình và truy vấn biểu đồ — 3:20 đến 5:20

[Mở Chart Builder → mở biểu đồ cột ID 5 → chỉ cấu hình Điểm thi, COUNT, tăng dần → bấm Xem trước.]

“Đây là Chart Builder, nơi người dùng tạo biểu đồ bằng cách chọn cấu hình.

Trong biểu đồ phổ điểm này, dimension, tức trường dùng để chia nhóm, là Điểm thi. Metric là số bài có điểm, được tính bằng COUNT trên cột điểm. Hệ thống sắp xếp các nhóm điểm tăng dần và hiển thị bằng biểu đồ cột.

Khi bấm Xem trước, frontend gửi cấu hình đến backend. Backend kiểm tra bảng, cột và phép tổng hợp hợp lệ, sau đó tạo câu truy vấn và đọc kết quả từ MySQL. Giao diện dùng ECharts để vẽ kết quả, đồng thời hiển thị bảng số liệu để kiểm tra.”

[Chỉ Xem trước, không lưu: đổi dimension thành Môn học, phép tổng hợp thành AVG, cột tổng hợp là Điểm thi → bấm Xem trước.]

“Em thay cách nhóm sang Môn học và chọn AVG trên Điểm thi. Kết quả lúc này là điểm trung bình theo từng môn.

Thao tác này cho thấy khi thay câu hỏi phân tích, người dùng chỉ cần thay cấu hình trên giao diện. Backend sử dụng thông tin cột của dataset để tạo truy vấn tương ứng.”

[Mở biểu đồ đường ID 6 → chỉ cách nhóm Theo khoảng số, từ 0 đến 10, độ rộng 1 → bấm Xem trước.]

“Biểu đồ thứ hai đếm số bài theo từng khoảng điểm và hiển thị bằng đường. Ở đây, mỗi khoảng rộng một điểm; khoảng cuối có tính cả điểm 10.

Chart Builder cũng cho phép thêm bộ lọc và chọn thứ tự sắp xếp. Khi lưu biểu đồ, ứng dụng lưu tên cùng cấu hình để mở lại; dữ liệu sẽ được truy vấn lại từ nguồn khi xem trước.”

## 6. Dashboard: tương tác và lưu bố cục — 5:20 đến 7:20

[Mở Dashboard ID 5. Chọn bộ lọc Tất cả → Áp dụng bộ lọc để bắt đầu từ toàn bộ dữ liệu.]

“Sau khi có các biểu đồ đã lưu, người dùng có thể thêm chúng vào dashboard. Ở đây em đã đưa hai biểu đồ từ cùng dataset lên một màn hình để quan sát đồng thời.

Người dùng có thể thêm hoặc gỡ biểu đồ. Khi gỡ, ứng dụng chỉ bỏ biểu đồ khỏi dashboard này; biểu đồ đã lưu vẫn còn để sử dụng lại.”

[Kéo tiêu đề một thẻ sang vị trí trống → kéo góc dưới bên phải để đổi kích thước → bấm Lưu bố cục.]

“Em có thể kéo tiêu đề để thay đổi vị trí và kéo góc thẻ để đổi kích thước. Sau khi bấm Lưu bố cục, vị trí và kích thước được lưu vào database cấu hình.”

[Chọn Môn học = Toán → Áp dụng bộ lọc → đợi cả hai biểu đồ cập nhật. Tiếp tục với Ngữ văn, rồi Tất cả.]

“Bộ lọc chung cho phép chọn một môn và áp dụng đồng thời cho cả hai biểu đồ. Khi chọn Toán rồi áp dụng, cả phổ điểm và số bài theo khoảng điểm đều được truy vấn lại với điều kiện môn Toán.

Em đổi sang Ngữ văn để kiểm tra tương tự. Khi chọn Tất cả, hệ thống bỏ điều kiện lọc chung này.

Bộ lọc chung chỉ tác động đến các biểu đồ thuộc dataset được chọn. Nếu biểu đồ có điều kiện riêng, hệ thống giữ điều kiện đó và kết hợp với bộ lọc chung bằng AND.”

[Chọn lại Toán → Áp dụng bộ lọc → tải lại trang.]

“Sau khi tải lại trang, dashboard vẫn giữ danh sách biểu đồ, bố cục và lựa chọn bộ lọc đã lưu.”

## 7. Đối chiếu kết quả và giải thích kỹ thuật — 7:20 đến 8:20

[Chuyển sang Workbench → chạy SQL đếm và nhóm điểm môn Toán → đối chiếu một vài nhóm với bảng kết quả trong Chart Builder.]

“Để kiểm chứng tính đúng, em đã đối chiếu kết quả của ứng dụng với các câu SQL chạy độc lập trên MySQL.

Trong bộ dữ liệu đã nghiệm thu, môn Toán có 34.952 bài có điểm, môn Ngữ văn có 35.015 bài và toàn bộ dữ liệu có 140.567 dòng điểm. Đây là số bài có điểm; số mã thí sinh duy nhất là 35.526.

Kết quả từng nhóm điểm và từng khoảng điểm đều đã được đối chiếu. Luồng cũng đã được kiểm tra trên trình duyệt, backend và MySQL thật, gồm lưu, mở lại, lọc, kéo thả, đổi kích thước và thêm, gỡ biểu đồ.

Về công nghệ, frontend dùng React và TypeScript; backend dùng Java Spring Boot; dữ liệu và cấu hình lưu trong MySQL.”

## 8. Phạm vi đã đạt và hướng phát triển — 8:20 đến 9:00

[Quay lại Dashboard.]

“Với phạm vi hiện tại, PoC đã kiểm chứng được luồng từ kết nối dữ liệu thật đến dataset, cấu hình biểu đồ, dashboard tương tác và lưu cấu hình để sử dụng lại.

Backend xử lý theo thông tin bảng và cột của dataset nên có thể dùng cho bảng dữ liệu khác, chẳng hạn bán hàng. Hiện ứng dụng hỗ trợ AVG và COUNT; nếu cần tính tổng doanh thu thì phải bổ sung SUM.

So với yêu cầu tổng thể, các phần như đăng nhập, phân quyền, SQL Lab, dataset ảo, chia sẻ và nhúng dashboard vẫn là hướng phát triển tiếp theo. Em xin kết thúc phần demo và nhận góp ý.”

## SQL chuẩn bị để đối chiếu

```sql
SELECT
    COUNT(score) AS so_bai_co_diem,
    COUNT(DISTINCT candidate_id) AS so_thi_sinh
FROM datademo_source.exam_scores;

SELECT COUNT(score) AS so_bai_toan
FROM datademo_source.exam_scores
WHERE subject_name = 'Toán';

SELECT score, COUNT(score) AS so_bai
FROM datademo_source.exam_scores
WHERE subject_name = 'Toán'
GROUP BY score
ORDER BY score;
```

Khi đối chiếu trên giao diện, mở biểu đồ cột đã lưu, thêm điều kiện Môn học bằng Toán rồi bấm Xem trước; không cần lưu thay đổi này. SQL trên đối chiếu biểu đồ nhóm theo từng giá trị điểm, không phải biểu đồ nhóm theo khoảng.

Nguồn kiểm chứng trong project: `docs/acceptance/step-10-acceptance.md`, `docs/step-8-save.md`, `docs/step-9-chart-builder.md`, `docs/step-10-dashboard.md` và `docs/data-preparation.md`.
