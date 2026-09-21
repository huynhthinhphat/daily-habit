# Daily Activity & Habit Tracker (Table Matrix)

Ứng dụng web theo dõi hoạt động và thói quen hàng ngày dạng bảng ma trận (Matrix Grid) trực quan, hiện đại và tiện lợi.

## ✨ Tính Năng Nổi Bật

- **Bảng Ma Trận Thông Minh (Table Matrix Grid)**:
  - **Cột trên cùng (Sticky Header)**: Hiển thị từng ngày trong tháng (1 đến 28/30/31), kèm thứ trong tuần (T2, T3, T4, T5, T6, T7, CN).
  - **Highlight Hôm nay (Today)**: Cột ngày hôm nay luôn được làm nổi bật với viền sáng và huy hiệu riêng.
  - **Cột bên trái cố định (Sticky Column)**: Danh sách hoạt động luôn đứng yên khi bạn cuộn ngang xem các ngày trong tháng.
  - **Điểm vuông góc giao nhau (Intersection Cells)**: Ô checkbox tương tác với hiệu ứng animation mượt mà, đổi màu đồng bộ theo từng hoạt động.
- **Quản Lý Hoạt Động Linh Hoạt**:
  - **Chỉnh sửa tên trực tiếp (Inline Edit)**: Nhấp đúp (double-click) chuột vào tên bất kỳ hoạt động nào hoặc bấm nút hình bút chì để gõ sửa tên ngay lập tức (nhấn Enter hoặc nhấp ra ngoài để lưu).
  - **Thêm hoạt động mới**: Hỗ trợ chọn danh mục (Sức khỏe, Học tập, Công việc, Đời sống, Tài chính...) và mã màu nhận diện riêng.
  - **Xóa hoạt động**: Có hộp thoại xác nhận an toàn trước khi xóa.
- **Thống Kê Trực Quan (Dashboard & Row Stats)**:
  - Tỷ lệ hoàn thành trong ngày hôm nay (% & số việc).
  - Tỷ lệ hoàn thành tổng thể cả tháng kèm thanh tiến độ.
  - Chuỗi ngày liên tục dài nhất (Streak).
  - Tiến độ hoàn thành của từng hoạt động hiển thị ở cột tổng kết bên phải.
  - Hàng tổng kết cuối bảng thống kê tổng số việc đã hoàn thành trong từng ngày.
- **Lưu Trữ & Tiện Ích Đầy Đủ**:
  - Tự động lưu mọi thay đổi vào **LocalStorage** (không mất dữ liệu khi tải lại trang hay tắt trình duyệt).
  - **Xuất / Nhập JSON**: Sao lưu và đồng bộ dữ liệu dễ dàng.
  - **Xuất CSV**: Tải file bảng tính tương thích 100% với Microsoft Excel (hỗ trợ hiển thị tiếng Việt UTF-8 BOM).
  - **Âm thanh tương tác (Sound Effect)**: Hiệu ứng âm thanh pop/ding vui tai khi tick hoàn thành (sử dụng Web Audio API tổng hợp, không cần tải file ngoài).
  - **Dark / Light Mode**: Chuyển đổi giao diện sáng/tối chỉ với 1 click.

---

## 🚀 Hướng Dẫn Sử Dụng & Mở Ứng Dụng

### Cách 1: Mở trực tiếp bằng trình duyệt
Bạn có thể nhấp đúp trực tiếp vào file `index.html` trong thư mục để mở trên bất kỳ trình duyệt nào (Chrome, Edge, Firefox...).

### Cách 2: Mở qua máy chủ cục bộ (Local Server)
Nếu bạn đang mở terminal tại thư mục này, chạy lệnh:
```bash
node server.js
```
Sau đó mở trình duyệt và truy cập: **[http://localhost:3000](http://localhost:3000)**

---

## 📁 Cấu Trúc Mã Nguồn

```
src_for_plan/
├── index.html           # Khung giao diện chính, modal và các controls
├── server.js            # Máy chủ tĩnh Node.js nhẹ nhàng
├── README.md            # Tài liệu hướng dẫn sử dụng
├── styles/
│   ├── main.css         # Hệ thống design tokens, màu sắc, Dark/Light theme
│   ├── table.css        # Bố cục Table Matrix, Sticky column/header, Checkboxes
│   └── components.css  # Thẻ thống kê, modal, nút bấm, chips và toast
└── js/
    ├── app.js           # Điều phối ứng dụng, gán sự kiện và cập nhật giao diện
    ├── storage.js       # Quản lý LocalStorage, seed data, Import/Export
    ├── tracker.js       # Xử lý tính toán thống kê, streaks và âm thanh Web Audio
    └── matrix.js        # Logic render bảng ma trận, hàng ngày, inline edit
```
