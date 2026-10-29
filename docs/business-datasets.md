# Hai dataset kinh doanh

Đã thêm hai bảng vật lý vào `datademo_source`, sử dụng kết nối reader hiện có. Dữ liệu điểm thi và các cấu hình cũ không thay đổi. Không thêm Online Retail.

| Dataset trên giao diện | Bảng nguồn | Số dòng | Mỗi dòng là |
|---|---|---:|---|
| Superstore — Bán hàng | superstore_sales | 9.994 | Một dòng sản phẩm trong đơn hàng |
| Coffee Shop — Bán cà phê | coffee_shop_sales | 149.116 | Một bản ghi giao dịch/sản phẩm |

Trên máy hiện tại: dataset ID 17 và 18, connection ID 15 (MySQL local). Các ID có thể khác nếu nhập vào máy khác. Vào Dataset hoặc Chart Builder, tải lại danh sách để chọn.

## Luồng demo

**Superstore**: chọn dataset → Cột → nhóm theo Nhóm sản phẩm → cột dùng tính Doanh số (USD) → SUM → xem trước. Thử Lợi nhuận (USD), hoặc COUNT DISTINCT trên Mã đơn hàng theo Khu vực.

**Coffee Shop**: chọn dataset → Cột → nhóm theo Cửa hàng → cột dùng tính Doanh thu (USD) → SUM → xem trước. Thử lọc Nhóm sản phẩm = Coffee, hoặc nhóm theo Nhóm sản phẩm và SUM Số lượng.

Có sẵn Tháng đặt hàng / Tháng giao dịch (YYYY-MM) để dùng biểu đồ đường theo tháng, vì project chưa có tự động chia nhóm ngày theo tháng.

## Nguồn và cách chuẩn bị

- Superstore: [Tableau](https://www.tableau.com/learn/tutorials/on-demand/getting-started), sheet Orders. Link gốc từ chối tải tự động, nên dùng [bản chia sẻ trên GitHub của Simplilearn-Edu](https://github.com/Simplilearn-Edu/Tableau-Datasets/blob/master/Project%202/Sample%20-%20Superstore.xls). Không dùng các sheet Returns/People hoặc ghép dữ liệu trả hàng. Đây là dữ liệu doanh nghiệp giả lập, không phải doanh số thực tế.
- Coffee Shop: [Maven Analytics](https://mavenanalytics.io/data-playground/coffee-shop-sales), [file ZIP công khai](https://maven-datasets.s3.amazonaws.com/Coffee+Shop+Sales/Coffee+Shop+Sales.zip), sheet Transactions. Đây là chuỗi cửa hàng giả lập. Trang hiện có thông tin số dòng không thống nhất; số 149.116 được xác minh trực tiếp từ workbook đã tải.
- Giữ file gốc, chuyển sang CSV UTF-8, không lấy mẫu hoặc tự dịch các giá trị sản phẩm/địa danh. Chỉ nhãn hiển thị cột được đặt tiếng Việt.
- Giữ lợi nhuận âm, giá trị 0, các tỷ lệ giảm giá và đơn vị USD. Số tiền/tỷ lệ chuẩn hóa tới 6 chữ số thập phân để loại sai số biểu diễn số thực Excel; không tự quy đổi sang VNĐ hay ép làm tròn tới cent.
- Coffee Shop bổ sung `revenue = transaction_qty × unit_price`. Đây là giá trị dòng giao dịch, chưa bao gồm các khoản thuế/chi phí không có trong nguồn.
- Mã dòng/giao dịch đặt Định danh. Các mã dùng để nhóm/đếm khác nhau như mã đơn hàng, mã khách hàng, mã sản phẩm đặt Phân nhóm để dùng COUNT/COUNT DISTINCT. Tiền, số lượng đặt Đo lường; đơn giá và tỷ lệ giảm giá mặc định AVG và không cho SUM.

Không nên lấy AVG doanh số dòng hàng rồi gọi là giá trị trung bình đơn hàng: một đơn có thể có nhiều dòng. COUNT thông thường đếm dòng, COUNT DISTINCT Mã đơn hàng mới đếm đơn hàng không trùng.

## Đối chiếu

- Superstore: tổng Sales **2.297.200,860300 USD**, tổng Profit **286.397,021700 USD**, Quantity **37.873**.
- Coffee Shop: tổng Revenue **698.812,330000 USD**, Quantity **214.470**.
- Toàn bộ ô trong hai bảng được đọc lại theo khóa chính và đối chiếu với CSV, không chỉ kiểm tra COUNT. Các tổng và truy vấn nhóm/lọc qua API được đối chiếu độc lập với CSV bằng Decimal.
- Xem [chuẩn bị](business-data-preparation.json), [nhập MySQL](business-data-import.json) và [đăng ký/kiểm tra API](business-datasets-registration.json). Tổng cộng của các trường đơn giá/tỷ lệ trong báo cáo chỉ phục vụ kiểm tra toàn vẹn, không phải chỉ số kinh doanh.

## Nhập lại trên máy khác

CSV/Excel gốc không nằm trên GitHub. Chuẩn bị file gốc tại `data/raw/business/superstore.xls` và `data/raw/business/coffee-shop.zip` từ các link đã ghi ở trên.

1. Cài dependency đọc file: `python -m pip install openpyxl xlrd pymysql`.
2. Từ thư mục gốc chạy `python scripts/business/prepare_business_data.py`.
3. Trong Workbench bằng root, chạy `scripts/grant-business-import.sql`; quyền chỉ áp dụng hai bảng mới.
4. Cấu hình tài khoản ứng dụng trong `backend/application-local.properties`, chạy `python scripts/business/import_business_data.py`. Script hiện dành cho MySQL localhost:3306 và đọc mật khẩu local; không in mật khẩu ra màn hình.
5. Chạy backend và đảm bảo đã có một kết nối reader tới datademo_source; chạy `python scripts/business/register_business_datasets.py`.

Importer không thay thế bảng đã có dữ liệu khác; nếu bảng đã có đủ dữ liệu giống CSV, chỉ xác minh rồi bỏ qua. Đăng ký API tái sử dụng dataset cùng kết nối/bảng, không ghi đè nhãn hay cấu hình người dùng. Không tạo thêm biểu đồ/dashboard tự động.

Sau khi nhập xong, có thể thu hồi quyền import bằng root; reader vẫn có quyền SELECT bình thường:

```sql
REVOKE SELECT, INSERT, CREATE ON datademo_source.superstore_sales FROM 'datademo_app_user'@'localhost';
REVOKE SELECT, INSERT, CREATE ON datademo_source.coffee_shop_sales FROM 'datademo_app_user'@'localhost';
```
