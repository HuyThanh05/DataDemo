# Bước 4 Tách layout routing và API frontend

## Cấu trúc

```text
src/
├── App.tsx                         # Theme, QueryClientProvider, BrowserRouter
├── app/
│   ├── AppRoutes.tsx               # Đường dẫn màn hình
│   └── queryClient.ts              # Chính sách cache/loading/refetch
├── layouts/
│   ├── AppLayout.tsx               # Sidebar, tìm kiếm, khung nội dung chung
│   └── app.css                     # Giữ style đã duyệt
├── features/
│   ├── connections/
│   │   ├── api.ts                  # API và query keys
│   │   ├── types.ts                # Request/response TypeScript
│   │   ├── components/             # Form, danh sách, metadata
│   │   └── pages/ConnectionsPage.tsx
│   └── datasets/pages/DatasetPage.tsx
├── shared/api/http.ts              # HTTP JSON và lỗi chung
└── test/                           # Thiết lập DOM kiểm thử
```

## Routing

- `/` chuyển về `/connections`.
- `/connections`: chức năng Kết nối đã có.
- `/datasets`: chỉ chọn kết nối và bảng, đúng phần 1 bước 8 đã làm.
- `/datasets?connectionId=7&table=exam_scores`: giữ lựa chọn qua tải lại và chia sẻ URL trên cùng môi trường.
- Chuyển màn hình dùng React Router, hỗ trợ Back/Forward; không còn ẩn/hiện hai main bằng state trong ConnectionsPage.
- Đường dẫn không hợp lệ chuyển về `/connections`. Kết nối hoặc bảng không còn tồn tại hiển thị cảnh báo, không tự chấp nhận tên bảng gửi qua URL.

ID phụ thuộc database ứng dụng hiện tại; URL không chứa mật khẩu. Form mật khẩu được xóa khi lưu thành công hoặc rời màn hình.

## API và trạng thái

Chỉ HTTP client dùng fetch. Module connections định nghĩa các hàm typed, không đổi endpoint/backend. Dataset tái sử dụng module API nguồn, chưa gọi API tạo/lưu dataset.

TanStack Query quản lý danh sách, bảng, cột theo connection ID và tên bảng, dùng AbortSignal để hủy request không còn được theo dõi. Sau khi lưu kết nối, danh sách được cập nhật và tải lại. Retry tự động tắt; lỗi có thể thử lại chủ động. Cache chỉ trong bộ nhớ; không persist localStorage.

Các request test/save có mật khẩu gọi trực tiếp từ form, không dùng query/mutation cache. Không lưu mật khẩu vào context, URL hoặc storage. Context layout chỉ chứa tìm kiếm và metadata kết nối đã chọn. Chưa thêm Redux hoặc store toàn cục khác.

## Kiểm tra

Từ thư mục frontend:

```powershell
npm test
npm run build
```

10 kiểm thử đạt, build TypeScript/Vite thành công. Kiểm thử DOM/API mock bao gồm mở trực tiếp Dataset, lựa chọn từ URL, điều hướng qua metadata và Back, kết nối/bảng sai, lỗi nguồn và retry, mật khẩu không vào cache, JSON lỗi, hủy request và payload POST. Không thay thế kiểm thử MySQL thật; bước này không sửa backend hoặc dữ liệu.

Vite vẫn cảnh báo bundle lớn do thư viện giao diện; chưa tách bundle/lazy-load vì ngoài phạm vi refactor hiện tại.

## Chạy và kiểm tra thủ công

Giữ MySQL và backend đang chạy. Chạy lại `npm run dev` nếu cần để nhận thư viện mới. Mở URL Local của Vite, thử:

1. `/connections`: chọn kết nối, xem exam_scores và 8 cột, tìm kiếm, kiểm tra lại.
2. Tạo dataset từ bảng này: URL chuyển sang `/datasets` với connectionId và table.
3. Tải lại trang Dataset: lựa chọn vẫn được đọc từ URL và xác minh bằng API.
4. Back/Forward và sidebar chuyển đúng màn hình, giữ style.

Không cần SQL/migration mới. Dataset chưa đặt tên, xem trước dữ liệu, đổi nhãn hoặc lưu.

Khi triển khai production sau này, web server phải trả index.html cho các đường dẫn frontend (SPA fallback), đồng thời chuyển `/api` đến backend. Vite dev đã hỗ trợ tải trực tiếp các đường dẫn này.
