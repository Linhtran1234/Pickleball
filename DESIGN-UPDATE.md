# Thiết kế theo nhận diện giải BMT Materials 2026

## Tài liệu đầu vào

- Logo chính thức: `RENEW.pdf`, một trang vector. Chuyển nguyên bản sang SVG (`public/assets/bmt-logo.svg`), không vẽ lại hoặc sửa tỷ lệ/màu của biểu tượng BMT.
- Poster khách hàng gửi trực tiếp trong chat: trời xanh, sân pickleball ngoài trời, chữ xanh đậm/vàng, nét xanh lá, mốc kỷ niệm 15 năm.

## Thay đổi

- Header, favicon, đăng nhập, footer và khu vực đầu trang dùng logo chính thức.
- Thiết kế lại phần đầu trang bằng HTML: tên giải chữ nghiêng xanh, Pickleball vàng trên vệt xanh, năm 2026, huy hiệu 15 năm, ngày/giờ/địa điểm, nút LIVE và lịch đấu.
- Nền sân là ảnh minh họa mới tạo theo phong cách tham chiếu, không phải ảnh sân Văn Thánh được xác thực. Không chèn ảnh poster chứa chữ làm toàn bộ giao diện; chữ web vẫn đọc và co giãn theo màn hình.
- Màu chính: xanh #075BA6, vàng #FFE329, xanh lá #8BC541, nền #F0F7FC. Giữ màu gốc của logo, màu level và trạng thái thi đấu.
- Thống nhất card thống kê, bảng, menu, nút, form, footer và đăng nhập trong `public/brand-theme.css`. LIVE MATCHES giữ bố cục tối cho màn hình trình chiếu.
- Mobile: hero co giãn, huy hiệu không đè tiêu đề, thống kê 2 cột; bảng cuộn trong card, menu cuộn ngang.
- Giữ quy mô mục tiêu 30 cặp/6 bảng/5 level/7 sân và luật/chức năng đã thống nhất. Theo yêu cầu mới nhất, dữ liệu giải đã reset hoàn toàn; xem REVIEW-REPORT.md.

## Kiểm tra

`npm test`: 25 bài test backend/frontend với dữ liệu giả riêng, gồm trạng thái trống, 8 tab ở 2 quyền và luồng tạo giải mới.

Chromium thật: 390px, 768px, 1440px; 8 tab ở mỗi kích thước; logo/tài sản tải thành công; đăng nhập Admin và xuất Excel trên database kiểm thử riêng. File Excel chia bảng đủ 6 cột, lịch đấu đủ 75 trận/7 sheet.

## Chạy

Node.js 22: `npm ci`, `npm start`. `npm test` để chạy lại kiểm thử. Database giải mới nằm tại `data/tournament.db`; ZIP source không chứa database hoặc node_modules. Seed không nạp mẫu; khởi động tự tạo trạng thái trống.

## Nâng cấp trải nghiệm và motion

Banner tràn viền hai bên, thêm countdown và dải nhận diện; nội dung quản lý vẫn có giới hạn chiều rộng để dễ đọc. Lộ trình bốn bước, header riêng cho từng trang, menu icon, bộ tìm trang nhanh và hệ thống motion dùng `public/ui.js`/`public/experience.css`. Chuyển động được giảm khi thiết bị bật Reduce Motion. Giữ nguyên nhận diện BMT, dữ liệu trống và luật thi đấu.

## Tinh chỉnh theo phản hồi

Ảnh VĐV nữ giữ váy thể thao xanh, kéo dài hơn để che kín khi vận động; chữ 15 năm màu vàng được phóng lớn trên nền trong suốt, không dùng bảng nền xanh. Header dùng gradient trắng–xanh nhạt; giữ logo BMT nguyên bản và banner tràn viền. LIVE nhận tự động trận/số điểm đang nhập qua SSE, đồng thời giữ chế độ nhập tay.

## Cập nhật thương hiệu và khu vực khán giả

- Tên hiển thị thống nhất **BMT MATERIALS** trên header, banner, footer, hỗ trợ Admin và file Excel. Giữ nguyên logo gốc và khóa lưu trữ trình duyệt để bảo toàn phiên đăng nhập/dữ liệu hiện có. Tên giải cũ trong database được chuẩn hóa khi đọc/lưu, không reset giải.
- Nâng cụm 15 năm trên desktop/tablet để dải băng không che mặt VĐV nam; chữ NĂM căn giữa dưới số. Thêm ánh vàng, điểm sáng và nhịp sáng nhẹ cho dải băng; tôn trọng tùy chọn giảm chuyển động.
- LIVE có bảng bên phải với hai tab Đã kết thúc / Các đội. Kết quả lấy từ lịch đấu đã lưu tỷ số hợp lệ, giữ lịch sử khi sân chuyển trận. Danh sách đội hiển thị VĐV, bảng, level, số trận và thắng/thua. Điểm đang nhập chưa tính là kết quả chính thức. Trên màn hình nhỏ, bảng chuyển xuống dưới các sân.
- Kiểm tra: 26 bài kiểm tra đạt; 40 tổ hợp tab/kích thước; dữ liệu giả lập chỉ trong trình duyệt với 30 đội và 7 kết quả chính thức, kiểm tra bố cục ở 6 chiều rộng và thao tác tab bằng bàn phím.

## Phối màu xanh – đỏ và khôi phục tên MATERIALS

Tên chính thức là **BMT MATERIALS** ở mọi nơi hiển thị và file Excel. Bản cập nhật chuẩn hóa tên dạng số ít trong database khi đọc/lưu; giữ khóa cache cũ, tài khoản và dữ liệu giải.

Màu xanh dẫn dắt các nền lớn, typography và sân đấu; đỏ BMT tạo khoảng 30% điểm nhấn thị giác qua mảng PICKLEBALL, CTA, bộ lọc đang chọn, icon điều hướng, bảng khán giả LIVE và footer. Các dải màu header/ticker chia xanh–đỏ 70/30. Vàng chỉ giữ làm điểm nhấn kỷ niệm 15 năm và một số chi tiết thể thao. Đây là tỷ lệ phối màu thị giác, không phải tỷ lệ pixel của ảnh nền.

Đã kiểm tra 26 test tự động và 40 tổ hợp tab/kích thước màn hình trong Chromium, bao gồm hỗ trợ giảm chuyển động.

## Banner theo màu poster và kỷ niệm 2.5D

Banner khôi phục chữ BMT xanh đậm, PICKLEBALL vàng trên mảng cọ xanh và 2026 trắng viền bóng xanh. Các điểm nhấn đỏ của phần còn lại website được giữ. Nền sân và VĐV không thay đổi.

Cụm kỷ niệm dùng vector riêng `public/assets/anniversary-15.svg`: số 15 nghiêng, vàng kim có viền nổi và chiều sâu, NĂM màu xanh trong lòng số 5, lụa vàng cong có nếp gấp và phần lụa xanh phía sau theo mẫu poster. Giữ nền trong suốt và vị trí cao để không che mặt VĐV nam. Hiệu ứng gồm ánh sáng lướt qua mặt số, điểm sáng và chuyển động nổi nhẹ; hỗ trợ prefers-reduced-motion. Vector giữ chữ rõ ở desktop/mobile.

Kiểm tra: 26 test đạt; Chromium xác nhận 40 tổ hợp tab/kích thước, banner tràn viền và giảm chuyển động. Đã xem ảnh desktop/mobile sau cập nhật.

## Chia bảng dạng thẻ và logo do Admin quản lý

Tiêu đề header/footer/login giữ cụm CÔNG TY trên cùng dòng. Chia bảng dùng sáu thẻ riêng: ba cột desktop, hai cột tablet và một cột điện thoại; mỗi thẻ có logo, tiến độ và năm ô đội hỗ trợ bàn phím.

Admin vào Chia bảng → Đổi logo tại bảng A–F, dán URL ảnh công khai HTTP(S) hoặc đường dẫn assets/, xem trước rồi Lưu logo. Để trống để trở về mặc định. Logo dùng chung cho bảng và các đội thuộc bảng, kể cả LIVE tự động; LIVE nhập tay vẫn có logo riêng. Logo được lưu trong SQLite và JSON export/import; Excel hiện không chèn ảnh. Người xem không có quyền lưu. Khởi động lại Node sau khi cập nhật để nạp phần lưu metadata mới; không cần reset dữ liệu.

Kiểm tra: 28 test đạt, gồm lưu/đọc lại logo qua API, từ chối người xem và URL không hợp lệ; Chromium kiểm tra 40 tổ hợp tab/màn hình và bốn chiều rộng với dữ liệu giả lập chỉ trong trình duyệt.
