# Rà soát và bàn giao giải mới

## Kết quả reset

- Database hiện tại: 0 VĐV, 0 cặp, 0 trận; trạng thái `setup`; 7 sân LIVE trống (Waiting, chưa có đội/điểm/ghi chú).
- Đã khôi phục tài khoản Admin từ bản sao lưu trong môi trường làm việc. Source công khai không chứa database, password hash hoặc thông tin đăng nhập cá nhân. Cài mới có hai tài khoản khởi tạo; reset giải giữ nguyên các tài khoản đang có.
- `seed-data.json`, JSON seed nhúng trong HTML và `freshState()` đều rỗng. `seed.js` không nạp bất kỳ người chơi mẫu nào.
- Thay namespace trình duyệt; loại bỏ ba khóa của giải trước khi tải bản mới. Không đọc lại cache cũ kể cả khi API mất kết nối.
- Gỡ file ZIP dữ liệu mẫu, ảnh/logo đội và nhà tài trợ cũ khỏi source. Database/bản sao lưu cũ không nằm trong gói giao.
- Giữ logo vector BMT chính thức, thiết kế mới, thông tin sự kiện và quy mô mục tiêu 30 cặp/6 bảng/5 level/7 sân. Đây là cấu hình; không có đội hoặc lịch thi đấu thực tế được nạp sẵn.

## Phạm vi rà soát

Đã đọc và đối chiếu backend/schema, đăng nhập/quản lý user, seed/reset/migration, toàn bộ module frontend, HTML/CSS và xuất dữ liệu. Thư viện bên thứ ba được kiểm tra phiên bản/audit, không tự chỉnh nội dung vendor.

## Các lỗi đã sửa

1. Lưu frontend chưa gửi `baseUpdatedAt`, bỏ qua khóa chống ghi đè sẵn có. Nay gửi phiên bản đã xác nhận; server yêu cầu phiên bản, kiểm tra trong transaction và tạo revision tăng đơn điệu.
2. Bản lưu bất đồng bộ không kiểm tra HTTP lỗi; auto-refresh có thể đè dữ liệu chưa lưu. Nay xử lý 400/401/403/409/500, giữ bản nháp, chặn polling khi có thay đổi chờ, lưu tuần tự và có nút thử lại khi lỗi tạm.
3. `sendBeacon` gửi POST vào API chỉ hỗ trợ PUT. Đã thay bằng luồng PUT có keepalive và bảo vệ khi rời trang; không còn truyền token trong query string.
4. Đăng xuất trong lúc còn bản lưu chờ có thể mất thay đổi. Nay chờ server xác nhận trước khi đăng xuất; nếu lỗi thì giữ phiên và báo cách xuất bản sao.
5. Role nằm trong token cũ không cập nhật khi hạ quyền/xóa user. Middleware nay tra tài khoản hiện tại mỗi request; đổi/reset mật khẩu thu hồi các phiên liên quan.
6. Đăng nhập HTTP lỗi có thể rơi vào tài khoản demo local. Chế độ local chỉ còn cho file trực tiếp; server lỗi không cấp quyền Admin demo.
7. JSON import/PUT thiếu validation. Thêm kiểm tra cấu trúc, ID/ID trùng, bảng/level, slot trùng, tham chiếu đội/trận, điều kiện bắt đầu, tỷ số và LIVE. Lỗi không xóa dữ liệu tốt đang có.
8. LIVE quick-fill so sánh số sân với chuỗi SQLite bằng `===`, làm mất danh sách trận. Nay chuẩn hóa để số/chuỗi đều khớp.
9. Fallback logo LIVE ghép tên vào JavaScript nội tuyến. Nay dùng fallback DOM với handler cố định; kiểm tra URL và tỷ số LIVE trước khi lưu, không âm thầm làm tròn số sai.
10. Ô lịch trống bị tính là “đã đấu” do `undefined !== null`. Chỉ thống kê trận có đủ hai đội và đủ điểm; giải trống không dựng podium thắng giả.
11. Lưu một trận có thể làm mất điểm đang sửa/xóa ở trận khác. Khôi phục cả bản nháp trống và bản nháp sửa điểm cũ sau re-render.
12. Migration lịch giữ nhầm chiều tỷ số khi hai đội đổi vị trí. Đã đảo score1/score2 theo đúng ID đội.
13. ExcelJS lỗi tải lần đầu không cho thử lại. Nay giải phóng promise lỗi; tiếp tục dùng bản cục bộ có giấy phép.
14. Cập nhật Express và phụ thuộc tương thích theo lockfile để xử lý các cảnh báo audit. Giữ Express 4 và kiến trúc cũ.

## Kiểm tra đã chạy

- `npm test`: **18 test đạt, 0 thất bại/skip**. Bao gồm khởi tạo trống, cache cũ, 8 tab × 2 quyền, đăng ký/ghép/chia bảng/start, nhiều ca tỷ số, giữ bản nháp, LIVE, API quyền, đổi quyền/mật khẩu, nhập sai, lưu đồng thời/lỗi/retry reset giữ nguyên tài khoản, khôi phục Admin, điều hướng nhanh, focus bàn phím và thông báo an toàn.
- Chromium thật: 8 tab trống ở 390/768/1440px; đăng ký VĐV qua modal, auto-pair, chọn bảng, nhập JSON giả, start, nhập điểm và reload, lấy trận LIVE từ dữ liệu SQLite, tải JSON/Excel và xung đột 409 giữa hai Admin. Reset cuối kiểm tra và reload xác nhận trống.
- File Excel kiểm tra đủ 6 cột bảng; lịch đủ 75 trận và 7 sheet trên fixture giả.
- `npm audit`: **0 cảnh báo được báo cáo** tại thời điểm kiểm tra. Đây là kết quả audit dependency, không phải cam kết không có mọi lỗ hổng.
- Source giao không chứa database cũ hoặc dữ liệu test đã chạy; cài mới tự tạo giải trống.

## Giữ nguyên và giới hạn

Luật ghép cặp, vòng tròn, thắng/thua, trần điểm, xếp hạng, 6 bảng/5 level/7 sân được giữ. LIVE tiếp tục là dữ liệu trình chiếu riêng theo logic cũ. Các bài test tự động dùng tên giả sinh tại runtime, không phải danh sách người thật của giải trước.

Chưa có thông tin liên hệ BMT hoặc tài sản nhà tài trợ nên không tự thêm. Đổi mật khẩu khởi tạo trước khi vận hành thực tế. Không tự triển khai website. Source được chuẩn bị để đẩy lên repository theo yêu cầu người dùng; tình trạng push được xác nhận trong lời bàn giao.

## Bổ sung UI/UX và quyền truy cập

- Banner đã tràn viền từ x=0 đến đúng chiều rộng viewport ở desktop, tablet và mobile.
- Thêm countdown, dải nhận diện chuyển động và lộ trình chuẩn bị giải 4 bước; không thay luật hoặc tự thêm VĐV.
- Menu icon và thanh chọn chuyển động; tìm nhanh Ctrl/Cmd+K hỗ trợ tiếng Việt không dấu, mũi tên và Enter.
- Card/reveal khi cuộn, ripple, chuyển tab, modal, toast và phản hồi tỷ số; có chế độ giảm chuyển động. Đếm số không chạy lại khi lưu trên cùng tab để tránh nhấp nháy số liệu.
- Modal có tên/role, focus ban đầu, focus trap, Escape và trả focus. Đăng nhập thêm hiện/ẩn mật khẩu và trang hỗ trợ.
- Lệnh reset không còn xóa bảng users. Test xác nhận ID, role, password hash và phiên Admin được giữ sau reset.
- Thêm `npm run admin:recover`: chạy tại máy chủ, không có API khôi phục công khai; không thay đổi VĐV/đội/trận hay user khác.

Kiểm tra bổ sung trên Chromium thật: 40 tổ hợp 8 tab × 5 chiều rộng (1920/1440/768/390/320px), đo banner x=0 và width=viewport, kiểm tra motion thực/Reduce Motion, Ctrl+K, tìm không dấu, focus/Escape, hiện mật khẩu và trang hỗ trợ. Không có lỗi JavaScript hoặc cuộn ngang ngoài ý muốn.
