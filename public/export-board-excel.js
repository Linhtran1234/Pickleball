/* =========================================================================
   XUẤT EXCEL — "Chia bảng" (chỉ Admin)
   Dùng thư viện ExcelJS đóng gói cục bộ để tạo file .xlsx
   có màu sắc / bố cục giống với bảng hiển thị trên web (ảnh mẫu BTC gửi
   cho trọng tài): 6 cột bảng đấu (A→F) x 5 hàng cấp độ (A→E), mỗi ô gồm
   tên 2 VĐV + công ty.
   ========================================================================= */

// Màu nền tiêu đề từng bảng — phỏng theo tông màu banner của từng bảng
// trên giao diện thật (xen kẽ xanh navy / đen / đỏ mận cho dễ phân biệt).
const BOARD_EXPORT_HEADER_COLORS = {
  A: 'FF1F3864', // navy
  B: 'FF1F1F1F', // đen
  C: 'FF7A1F1F', // đỏ mận
  D: 'FF1F3864', // navy
  E: 'FF1F3864', // navy
  F: 'FF1F1F1F', // đen
};

// Màu tô nhạt cho từng cấp độ (A-E), dùng làm nền ô đội trong mỗi bảng.
const BOARD_EXPORT_LEVEL_TINTS = {
  A: 'FFFCE4E4',
  B: 'FFFDEBD0',
  C: 'FFD9F2E3',
  D: 'FFD6E9F8',
  E: 'FFE8DAEF',
};

// Tải ExcelJS cục bộ ĐỘNG (chỉ khi cần xuất file), KHÔNG tải sẵn lúc mở
// trang — tránh trường hợp CDN bị chặn/mạng chậm làm treo cả trang, khiến
// các nút bấm khác (kể cả chuyển tab) không phản hồi được.
const EXCELJS_LOCAL_URL = 'vendor/exceljs-4.4.0.min.js';
let _exceljsLoadPromise = null;
function ensureExcelJsLoaded(){
  if(typeof ExcelJS !== 'undefined') return Promise.resolve();
  if(_exceljsLoadPromise) return _exceljsLoadPromise;
  _exceljsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = EXCELJS_LOCAL_URL;
    const timeoutId = setTimeout(() => {
      reject(new Error('Hết thời gian chờ tải thư viện Excel (kiểm tra kết nối đến server)'));
    }, 15000);
    script.onload = () => { clearTimeout(timeoutId); typeof ExcelJS!=='undefined' ? resolve() : reject(new Error('Thư viện Excel không khởi tạo được')); };
    script.onerror = () => { clearTimeout(timeoutId); reject(new Error('Không tải được thư viện Excel trên server')); };
    document.head.appendChild(script);
  });
  _exceljsLoadPromise = _exceljsLoadPromise.catch(error=>{_exceljsLoadPromise=null;throw error;});
  return _exceljsLoadPromise;
}

async function exportBoardToExcel(){
  if(!isAdmin()) return;
  showToast('Đang chuẩn bị file Excel...', 'success');
  try{
    await ensureExcelJsLoaded();
  }catch(err){
    console.error(err);
    showToast('Không tải được thư viện xuất Excel — kiểm tra kết nối đến server rồi thử lại. (' + err.message + ')', 'error');
    return;
  }
  try{
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BMT MATERIAL PICKLEBALL 2026 - KỶ NIỆM 15 NĂM THÀNH LẬP CÔNG TY';
    wb.created = new Date();
    const ws = wb.addWorksheet('Chia bảng', {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ showGridLines: false }],
    });

    const nCols = GROUPS.length; // 6

    // ---- Tiêu đề ----
    ws.mergeCells(1, 1, 1, nCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = 'BMT MATERIAL PICKLEBALL 2026 - KỶ NIỆM 15 NĂM THÀNH LẬP CÔNG TY — CHIA BẢNG ĐẤU';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1F3864' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(1).height = 48;

    ws.mergeCells(2, 1, 2, nCols);
    const subCell = ws.getCell(2, 1);
    subCell.value = `Chia ${GROUPS.length} bảng đấu — mỗi bảng đủ ${LEVELS.length} cấp độ (${LEVELS[0]}–${LEVELS[LEVELS.length-1]})`;
    subCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF595959' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    const thin = { style: 'thin', color: { argb: 'FFB7B7B7' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    // ---- Hàng tiêu đề từng bảng ----
    const headerRowIdx = 4;
    const headerRow = ws.getRow(headerRowIdx);
    GROUPS.forEach((g, i) => {
      const col = i + 1;
      const occ = occupantsOfGroup(g).length;
      const cell = ws.getCell(headerRowIdx, col);
      cell.value = `${groupName(g)}   (${occ}/${LEVELS.length})`;
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BOARD_EXPORT_HEADER_COLORS[g] || 'FF1F3864' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = border;
    });
    headerRow.height = 26;

    // ---- Dữ liệu: mỗi cấp độ chiếm 2 hàng (tên + công ty) ----
    let row = headerRowIdx + 1;
    LEVELS.forEach((lvl) => {
      GROUPS.forEach((g, i) => {
        const col = i + 1;
        const t = teamSlot(g, lvl);
        const tint = BOARD_EXPORT_LEVEL_TINTS[lvl] || 'FFFFFFFF';

        const nameCell = ws.getCell(row, col);
        const clubCell = ws.getCell(row + 1, col);

        if(t){
          const p1Name = (t.p1 && t.p1.name) ? t.p1.name : '?';
          const p2Name = (t.p2 && t.p2.name) ? t.p2.name : '?';
          const p1Co = (t.p1 && t.p1.company) ? t.p1.company : '';
          const p2Co = (t.p2 && t.p2.company) ? t.p2.company : '';
          nameCell.value = `${lvl}. ${p1Name} & ${p2Name}`;
          const clubParts = [p1Co, p2Co].filter(Boolean);
          clubCell.value = clubParts.length ? clubParts.join(' / ') : '';
        } else {
          nameCell.value = `${lvl}. — Trống —`;
          clubCell.value = '';
        }

        nameCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1F1F1F' } };
        nameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
        nameCell.border = border;

        clubCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF7F7F7F' } };
        clubCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        clubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
        clubCell.border = border;
      });
      ws.getRow(row).height = 30;
      ws.getRow(row + 1).height = 16;
      row += 2;
    });

    // ---- Độ rộng cột ----
    for(let c = 1; c <= nCols; c++){
      ws.getColumn(c).width = 30;
    }
    ws.views = [{ state: 'frozen', ySplit: headerRowIdx, showGridLines: false }];

    // ---- Xuất file ----
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `BMT_Pickleball_ChiaBang_${ts}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    showToast('Đã xuất file Excel Chia bảng thành công', 'success');
  }catch(err){
    console.error('Lỗi xuất Excel:', err);
    showToast('Xuất Excel thất bại: ' + (err && err.message ? err.message : String(err)), 'error');
  }
}
