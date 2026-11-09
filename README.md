# FB NOTE - VanIT 🎵📝

> Extension Chrome mở khoá toàn bộ tính năng và giới hạn của Facebook Notes / Messenger Notes trên máy tính (PC).

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)
![React](https://img.shields.io/badge/react-18.3-61dafb.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.6-3178c6.svg)

---

## ✨ Tính năng nổi bật

* 📝 **Viết ghi chú dài không giới hạn**: Cho phép gõ tối đa **600 ký tự** (vượt qua giới hạn mặc định 60 ký tự của Facebook).
* ⏱ **Thời hạn tuỳ chỉnh linh hoạt**: Chọn nhanh các mốc `30m`, `1h`, `3h`, `6h`, `12h`, `24h`, `3d`, `7d` hoặc nhập số phút/giờ/ngày tuỳ ý (tối đa lên đến **8 ngày**).
* 🎵 **Kho nhạc Facebook & Cắt nhạc 30s trên PC**: Tìm kiếm trực tiếp bài hát trong kho bản quyền của Facebook, nghe thử và kéo thanh sóng nhạc (waveform) để cắt đoạn 30 giây yêu thích.
* 🔒 **Tin nhắn ẩn (Hidden Notes)**: Giấu nội dung bí mật vào trong note bằng các ký tự Unicode tàng hình. Người dùng cài extension sẽ tự động giải mã được tin nhắn với huy hiệu 🔒 tím.
* 😀 **Bảng chọn Emoji tích hợp sẵn**: Chèn nhanh emoji theo 4 nhóm biểu cảm phổ biến chỉ với 1 cú click.
* 👥 **Lưu nhóm bạn bè (Saved Groups)**: Tuỳ chỉnh người xem và lưu danh sách bạn bè thành nhóm (*Bạn thân*, *Gia đình*,...) để dùng lại nhanh chóng.
* ⏰ **Hẹn giờ đăng (Schedule Note)**: Đặt lịch đăng ghi chú tự động vào thời điểm định sẵn trong tương lai qua `chrome.alarms`.
* 🔄 **Tự động đăng lại (Auto-repost)**: Tự động đăng lại ghi chú khi hết hạn (cấu hình từ 1 đến 10 lần).
* 📜 **Lịch sử ghi chú (History)**: Tự động lưu lại các note đã tạo, hỗ trợ nút "Dùng lại" (Reuse) 1 chạm nạp lại toàn bộ nội dung, bài hát và cấu hình.
* 🎨 **Giao diện hiện đại & Đa chủ đề**: Chuẩn phong cách thiết kế của Meta/Facebook, hỗ trợ chế độ **Dark / Light / Theo hệ thống**, song ngữ **Tiếng Việt & English**.

---

## 🚀 Hướng dẫn cài đặt vào Chrome

1. Tải về thư mục dự án hoặc clone repository:
   ```bash
   git clone https://github.com/DinhVen/FB-NOTE-VanIT.git
   ```
2. Mở trình duyệt Chrome và truy cập: `chrome://extensions/`
3. Bật **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Bấm nút **Tải bản giải nén (Load unpacked)** và chọn thư mục dự án.
5. Ghim extension lên thanh công cụ và trải nghiệm!

---

## 🛠 Phát triển & Đóng gói (Development)

Dự án sử dụng **Vite + React 18 + TypeScript + Ionicons**:

```bash
# Cài đặt thư viện
npm install

# Build extension
npm run build

# Chế độ theo dõi thay đổi (Watch mode)
npm run dev
```

---

## 👤 Tác giả

* **VanIT (Nguyễn Đình Văn)**
* GitHub: [@DinhVen](https://github.com/DinhVen)

---

## 📄 Bản quyền

Dự án được phát triển nhằm mục đích học tập và nâng cao trải nghiệm người dùng trên Facebook.
