/* =========================================================================
   schedule.js — LỊCH THI ĐẤU CỐ ĐỊNH (nguồn dữ liệu DUY NHẤT)
   File này được dùng CHUNG bởi cả client (public/index.html nạp qua thẻ
   <script>) và server (migrate/seed script nạp qua require()). Tuyệt đối
   không định nghĩa lại FIXED_SCHEDULE ở nơi khác — mọi thay đổi lịch đấu
   (sân, lượt, cặp bảng) chỉ sửa duy nhất ở đây, để tránh tình trạng dữ
   liệu trong database (matches.time_slot) bị lệch khỏi lịch mà code đang
   dùng để lọc/hiển thị.

   CẬP NHẬT LỊCH (2026-07-28): đổi từ mô hình "7 sân dùng chung, mỗi cấp độ
   trải đều khắp 7 sân theo 5 Lượt vòng tròn" sang mô hình MỖI CẤP ĐỘ CÓ SÂN
   RIÊNG, đúng theo file Excel "DS THI ĐẤU 30-7 VĂN THÁNH":
     - Cấp độ A (Level 1) -> Sân VIP 1 (court 1) & Sân VIP 1A (court 2)
     - Cấp độ B (Level 2) -> Sân VIP 2 (court 3) & Sân 6 (court 7)
     - Cấp độ C (Level 3) -> Sân 5 (court 6)
     - Cấp độ D (Level 4) -> Sân 4 (court 5)
     - Cấp độ E (Level 5) -> Sân 3 (court 4)
   Mỗi cấp độ có 6 đội (bảng A-F), đấu vòng tròn đầy đủ 15 trận theo ĐÚNG thứ
   tự trận trong file Excel (1-6, 2-5, 3-4, 1-5, 6-4, 2-3, 1-4, 5-3, 6-2, 1-3,
   4-2, 5-6, 1-2, 3-6, 4-5 — số ở đây là số thứ tự đội theo danh sách VĐV,
   tương ứng bảng A=1, B=2, C=3, D=4, E=5, F=6). Với 2 cấp độ có 2 sân riêng
   (Level 1, Level 2), 15 trận được chia luân phiên giữa 2 sân theo đúng thứ
   tự Excel (trận lẻ -> sân thứ nhất, trận chẵn -> sân thứ hai) để 2 sân thi
   đấu song song, mỗi sân có phần Lượt tăng dần riêng (không liên quan gì đến
   Lượt của sân kia). Với 3 cấp độ chỉ có 1 sân (Level 3/4/5), cả 15 trận thi
   đấu tuần tự trên cùng 1 sân, Lượt 1 -> Lượt 15.
   LƯU Ý QUAN TRỌNG: mỗi cặp (Sân, Lượt) giờ đây LUÔN gắn với đúng 1 Cấp độ
   duy nhất (vì mỗi sân chỉ phục vụ 1 cấp độ) và Lượt không lặp lại trong
   cùng 1 sân — bắt buộc phải giữ tính chất này (không được để 2 dòng trùng
   court+time+level) vì đây chính là khóa app dùng để khớp tỷ số đã nhập khi
   "làm mới lịch đấu" (xem app.js regenerateMatches / migrate-schedule.js).
   ========================================================================= */
(function (root) {
// LỊCH THI ĐẤU CỐ ĐỊNH — 7 sân (mỗi sân/cặp sân phục vụ đúng 1 cấp độ), tổng
// 75 trận, không gắn giờ cụ thể — mỗi sân tự thi đấu tuần tự các trận được
// phân vào sân đó theo tốc độ riêng, tránh áp lực thời gian.
const FIXED_SCHEDULE = [
  { court:1, time:"Lượt 1", level:"A", groupA:"A", groupB:"F", empty:false },
  { court:2, time:"Lượt 1", level:"A", groupA:"B", groupB:"E", empty:false },
  { court:1, time:"Lượt 2", level:"A", groupA:"C", groupB:"D", empty:false },
  { court:2, time:"Lượt 2", level:"A", groupA:"A", groupB:"E", empty:false },
  { court:1, time:"Lượt 3", level:"A", groupA:"F", groupB:"D", empty:false },
  { court:2, time:"Lượt 3", level:"A", groupA:"B", groupB:"C", empty:false },
  { court:1, time:"Lượt 4", level:"A", groupA:"A", groupB:"D", empty:false },
  { court:2, time:"Lượt 4", level:"A", groupA:"E", groupB:"C", empty:false },
  { court:1, time:"Lượt 5", level:"A", groupA:"F", groupB:"B", empty:false },
  { court:2, time:"Lượt 5", level:"A", groupA:"A", groupB:"C", empty:false },
  { court:1, time:"Lượt 6", level:"A", groupA:"D", groupB:"B", empty:false },
  { court:2, time:"Lượt 6", level:"A", groupA:"E", groupB:"F", empty:false },
  { court:1, time:"Lượt 7", level:"A", groupA:"A", groupB:"B", empty:false },
  { court:2, time:"Lượt 7", level:"A", groupA:"C", groupB:"F", empty:false },
  { court:1, time:"Lượt 8", level:"A", groupA:"D", groupB:"E", empty:false },
  { court:3, time:"Lượt 1", level:"B", groupA:"A", groupB:"F", empty:false },
  { court:7, time:"Lượt 1", level:"B", groupA:"B", groupB:"E", empty:false },
  { court:3, time:"Lượt 2", level:"B", groupA:"C", groupB:"D", empty:false },
  { court:7, time:"Lượt 2", level:"B", groupA:"A", groupB:"E", empty:false },
  { court:3, time:"Lượt 3", level:"B", groupA:"F", groupB:"D", empty:false },
  { court:7, time:"Lượt 3", level:"B", groupA:"B", groupB:"C", empty:false },
  { court:3, time:"Lượt 4", level:"B", groupA:"A", groupB:"D", empty:false },
  { court:7, time:"Lượt 4", level:"B", groupA:"E", groupB:"C", empty:false },
  { court:3, time:"Lượt 5", level:"B", groupA:"F", groupB:"B", empty:false },
  { court:7, time:"Lượt 5", level:"B", groupA:"A", groupB:"C", empty:false },
  { court:3, time:"Lượt 6", level:"B", groupA:"D", groupB:"B", empty:false },
  { court:7, time:"Lượt 6", level:"B", groupA:"E", groupB:"F", empty:false },
  { court:3, time:"Lượt 7", level:"B", groupA:"A", groupB:"B", empty:false },
  { court:7, time:"Lượt 7", level:"B", groupA:"C", groupB:"F", empty:false },
  { court:3, time:"Lượt 8", level:"B", groupA:"D", groupB:"E", empty:false },
  { court:6, time:"Lượt 1", level:"C", groupA:"A", groupB:"F", empty:false },
  { court:6, time:"Lượt 2", level:"C", groupA:"B", groupB:"E", empty:false },
  { court:6, time:"Lượt 3", level:"C", groupA:"C", groupB:"D", empty:false },
  { court:6, time:"Lượt 4", level:"C", groupA:"A", groupB:"E", empty:false },
  { court:6, time:"Lượt 5", level:"C", groupA:"F", groupB:"D", empty:false },
  { court:6, time:"Lượt 6", level:"C", groupA:"B", groupB:"C", empty:false },
  { court:6, time:"Lượt 7", level:"C", groupA:"A", groupB:"D", empty:false },
  { court:6, time:"Lượt 8", level:"C", groupA:"E", groupB:"C", empty:false },
  { court:6, time:"Lượt 9", level:"C", groupA:"F", groupB:"B", empty:false },
  { court:6, time:"Lượt 10", level:"C", groupA:"A", groupB:"C", empty:false },
  { court:6, time:"Lượt 11", level:"C", groupA:"D", groupB:"B", empty:false },
  { court:6, time:"Lượt 12", level:"C", groupA:"E", groupB:"F", empty:false },
  { court:6, time:"Lượt 13", level:"C", groupA:"A", groupB:"B", empty:false },
  { court:6, time:"Lượt 14", level:"C", groupA:"C", groupB:"F", empty:false },
  { court:6, time:"Lượt 15", level:"C", groupA:"D", groupB:"E", empty:false },
  { court:5, time:"Lượt 1", level:"D", groupA:"A", groupB:"F", empty:false },
  { court:5, time:"Lượt 2", level:"D", groupA:"B", groupB:"E", empty:false },
  { court:5, time:"Lượt 3", level:"D", groupA:"C", groupB:"D", empty:false },
  { court:5, time:"Lượt 4", level:"D", groupA:"A", groupB:"E", empty:false },
  { court:5, time:"Lượt 5", level:"D", groupA:"F", groupB:"D", empty:false },
  { court:5, time:"Lượt 6", level:"D", groupA:"B", groupB:"C", empty:false },
  { court:5, time:"Lượt 7", level:"D", groupA:"A", groupB:"D", empty:false },
  { court:5, time:"Lượt 8", level:"D", groupA:"E", groupB:"C", empty:false },
  { court:5, time:"Lượt 9", level:"D", groupA:"F", groupB:"B", empty:false },
  { court:5, time:"Lượt 10", level:"D", groupA:"A", groupB:"C", empty:false },
  { court:5, time:"Lượt 11", level:"D", groupA:"D", groupB:"B", empty:false },
  { court:5, time:"Lượt 12", level:"D", groupA:"E", groupB:"F", empty:false },
  { court:5, time:"Lượt 13", level:"D", groupA:"A", groupB:"B", empty:false },
  { court:5, time:"Lượt 14", level:"D", groupA:"C", groupB:"F", empty:false },
  { court:5, time:"Lượt 15", level:"D", groupA:"D", groupB:"E", empty:false },
  { court:4, time:"Lượt 1", level:"E", groupA:"A", groupB:"F", empty:false },
  { court:4, time:"Lượt 2", level:"E", groupA:"B", groupB:"E", empty:false },
  { court:4, time:"Lượt 3", level:"E", groupA:"C", groupB:"D", empty:false },
  { court:4, time:"Lượt 4", level:"E", groupA:"A", groupB:"E", empty:false },
  { court:4, time:"Lượt 5", level:"E", groupA:"F", groupB:"D", empty:false },
  { court:4, time:"Lượt 6", level:"E", groupA:"B", groupB:"C", empty:false },
  { court:4, time:"Lượt 7", level:"E", groupA:"A", groupB:"D", empty:false },
  { court:4, time:"Lượt 8", level:"E", groupA:"E", groupB:"C", empty:false },
  { court:4, time:"Lượt 9", level:"E", groupA:"F", groupB:"B", empty:false },
  { court:4, time:"Lượt 10", level:"E", groupA:"A", groupB:"C", empty:false },
  { court:4, time:"Lượt 11", level:"E", groupA:"D", groupB:"B", empty:false },
  { court:4, time:"Lượt 12", level:"E", groupA:"E", groupB:"F", empty:false },
  { court:4, time:"Lượt 13", level:"E", groupA:"A", groupB:"B", empty:false },
  { court:4, time:"Lượt 14", level:"E", groupA:"C", groupB:"F", empty:false },
  { court:4, time:"Lượt 15", level:"E", groupA:"D", groupB:"E", empty:false },
];
  root.FIXED_SCHEDULE = FIXED_SCHEDULE;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { FIXED_SCHEDULE: FIXED_SCHEDULE };
  }
})(typeof window !== "undefined" ? window : globalThis);