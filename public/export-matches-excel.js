/* =========================================================================
   XUẤT EXCEL — "Thi đấu & Tỷ số" (chỉ Admin)
   Xuất TOÀN BỘ lịch thi đấu ra file .xlsx NHIỀU TAB cho dễ tra cứu/in:
     - Tab "Tất cả"   : đủ 75 trận, sắp theo đúng thứ tự thi đấu thật
     - Tab "Bảng A".."Bảng F": CHỈ các trận có đội của bảng đó, và luôn đặt
       đội của chính bảng đó ở cột "Đội nhà" (bên trái) — đội đối thủ (bảng
       khác) ở cột "Đội khách" (bên phải), để BTC in riêng từng bảng phát
       cho đúng nhóm phụ trách/đúng đội mà không phải dò xem đội mình nằm
       cột nào mỗi trận.
   Dùng lại ensureExcelJsLoaded() đã khai báo ở export-board-excel.js
   (file này PHẢI được nạp SAU export-board-excel.js trong index.html).
   ========================================================================= */

const MATCHES_EXPORT_LEVEL_TINTS = { A:'FFFCE4E4', B:'FFFDEBD0', C:'FFD9F2E3', D:'FFD6E9F8', E:'FFE8DAEF' };

// Cột dùng chung cho tab "Tất cả" (không có khái niệm đội nhà/đội khách).
const MATCHES_EXPORT_COLS_ALL = [
  { header: 'STT',           key: 'stt',    width: 6  },
  { header: 'Lượt đấu',      key: 'round',  width: 11 },
  { header: 'Sân',           key: 'court',  width: 11 },
  { header: 'Level',         key: 'level',  width: 9  },
  { header: 'Bảng đội 1',    key: 'g1',     width: 18 },
  { header: 'Đội 1',         key: 't1',     width: 30 },
  { header: 'Công ty đội 1', key: 't1co',   width: 22 },
  { header: 'Tỷ số',         key: 'score',  width: 12 },
  { header: 'Bảng đội 2',    key: 'g2',     width: 18 },
  { header: 'Đội 2',         key: 't2',     width: 30 },
  { header: 'Công ty đội 2', key: 't2co',   width: 22 },
  { header: 'Trạng thái',    key: 'status', width: 13 },
];

// Cột dùng cho tab riêng từng Bảng — "nhà" luôn là đội của bảng đang xem.
const MATCHES_EXPORT_COLS_GROUP = [
  { header: 'STT',            key: 'stt',    width: 6  },
  { header: 'Lượt đấu',       key: 'round',  width: 11 },
  { header: 'Sân',            key: 'court',  width: 11 },
  { header: 'Level',          key: 'level',  width: 9  },
  { header: 'Đội nhà',        key: 't1',     width: 30 },
  { header: 'Công ty',        key: 't1co',   width: 22 },
  { header: 'Tỷ số',          key: 'score',  width: 12 },
  { header: 'Đội khách',      key: 't2',     width: 30 },
  { header: 'Công ty',        key: 't2co',   width: 22 },
  { header: 'Bảng đối thủ',   key: 'g2',     width: 18 },
  { header: 'Trạng thái',     key: 'status', width: 13 },
];

function matchesExportSubtitle(rows){
  const doneCount = rows.filter(r => r._isDone).length;
  return `Tổng ${rows.length} trận · ${doneCount} đã có tỷ số · Xuất lúc ${new Date().toLocaleString('vi-VN')}`;
}

// Viết 1 sheet lịch đấu. `rows` là mảng object đã chuẩn hoá sẵn theo đúng
// field trong `cols` (không đọc trực tiếp từ STATE.matches nữa) để dùng
// chung được cho cả tab "Tất cả" lẫn tab riêng từng bảng (đã đảo chỗ đội
// nhà/đội khách).
function writeMatchSheet(wb, sheetName, titleText, subtitleText, cols, rows){
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  const nCols = cols.length;

  ws.mergeCells(1, 1, 1, nCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = titleText;
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF1F3864' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(1).height = 48;

  ws.mergeCells(2, 1, 2, nCols);
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitleText;
  subCell.font = { name: 'Arial', size: 10.5, italic: true, color: { argb: 'FF595959' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 17;

  const headerRowIdx = 4;
  const thin = { style: 'thin', color: { argb: 'FFB7B7B7' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  cols.forEach((c, i) => {
    const cell = ws.getCell(headerRowIdx, i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
    ws.getColumn(i + 1).width = c.width;
  });
  ws.getRow(headerRowIdx).height = 22;

  const leftAlignKeys = new Set(['t1','t2','t1co','t2co']);
  let row = headerRowIdx + 1;
  rows.forEach((r) => {
    const tint = MATCHES_EXPORT_LEVEL_TINTS[r.level] || 'FFFFFFFF';
    cols.forEach((c, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = r[c.key];
      cell.border = border;
      cell.alignment = { horizontal: leftAlignKeys.has(c.key) ? 'left' : 'center', vertical: 'middle', wrapText: true };
      // Tô xanh tên đội thắng, y hệt màu var(--green) web dùng cho đội thắng
      // (kèm 👑 đã gắn sẵn trong giá trị t1/t2 ở bước build rows).
      const isWinnerCell = (c.key==='t1' && r._win1) || (c.key==='t2' && r._win2);
      cell.font = {
        name: 'Arial', size: 10,
        bold: (c.key==='t1'||c.key==='t2'||c.key==='score'),
        color: isWinnerCell ? { argb: 'FF1E8449' } : undefined,
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
    });
    const statusCol = cols.findIndex(c=>c.key==='status') + 1;
    ws.getCell(row, statusCol).font = { name: 'Arial', size: 10, bold: true, color: { argb: r._isDone ? 'FF1E8449' : 'FFB7472A' } };
    row++;
  });

  ws.views = [{ state: 'frozen', ySplit: headerRowIdx, showGridLines: false }];
  if(rows.length){
    ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: nCols } };
  }
  return ws;
}

// Định dạng tỷ số Y HỆT cách web hiển thị (span "score1 : score2", "-" khi
// chưa có điểm) — trước đây Excel dùng "— : —" / dấu "-" khác web, không
// đồng bộ. Nhãn trạng thái cũng phải khớp đúng chữ web đang dùng ở nút lọc
// "Chưa đấu" / "Đã có tỷ số" (trước đây Excel ghi "Đã đấu" — sai chữ).
function matchScoreDisplay(s1, s2){
  return `${s1!==null?s1:'-'} : ${s2!==null?s2:'-'}`;
}
function matchStatusLabel(isDone){
  return isDone ? 'Đã có tỷ số' : 'Chưa đấu';
}

function matchesExportRowsAll(sortedMatches){
  return sortedMatches.map((m, idx) => {
    const t1 = getTeam(m.team1);
    const t2 = getTeam(m.team2);
    const isDone = m.score1 !== null && m.score2 !== null;
    const win1 = isDone && Number(m.score1) > Number(m.score2);
    const win2 = isDone && Number(m.score2) > Number(m.score1);
    return {
      stt: idx + 1,
      round: m.time || '',
      court: courtLabel(m.court),
      level: m.level || '',
      g1: t1 ? groupName(m.groupA) : '',
      t1: t1 ? (win1?'👑 ':'') + teamDisplayName(t1) : '(trống)',
      t1co: t1 ? [t1.p1 && t1.p1.company, t1.p2 && t1.p2.company].filter(Boolean).join(' / ') : '',
      score: matchScoreDisplay(m.score1, m.score2),
      g2: t2 ? groupName(m.groupB) : '',
      t2: t2 ? (win2?'👑 ':'') + teamDisplayName(t2) : '(trống)',
      t2co: t2 ? [t2.p1 && t2.p1.company, t2.p2 && t2.p2.company].filter(Boolean).join(' / ') : '',
      status: matchStatusLabel(isDone),
      _isDone: isDone,
      _win1: win1, _win2: win2,
    };
  });
}

// Lọc + đảo chiều (nếu cần) để đội của `group` LUÔN nằm ở vị trí "nhà".
function matchesExportRowsForGroup(sortedMatches, group){
  const filtered = sortedMatches.filter(m => m.groupA === group || m.groupB === group);
  return filtered.map((m, idx) => {
    // Nếu đội "nhà" đang nằm ở vị trí team2 (groupB===group) thì đảo lại
    // toàn bộ cặp team1<->team2 để cột "Đội nhà" luôn đúng là đội bảng này.
    const homeIsTeam1 = m.groupA === group;
    const homeTeamId = homeIsTeam1 ? m.team1 : m.team2;
    const awayTeamId = homeIsTeam1 ? m.team2 : m.team1;
    const awayGroup = homeIsTeam1 ? m.groupB : m.groupA;
    const homeScore = homeIsTeam1 ? m.score1 : m.score2;
    const awayScore = homeIsTeam1 ? m.score2 : m.score1;

    const home = getTeam(homeTeamId);
    const away = getTeam(awayTeamId);
    const isDone = m.score1 !== null && m.score2 !== null;
    const winHome = isDone && Number(homeScore) > Number(awayScore);
    const winAway = isDone && Number(awayScore) > Number(homeScore);

    return {
      stt: idx + 1,
      round: m.time || '',
      court: courtLabel(m.court),
      level: m.level || '',
      t1: home ? (winHome?'👑 ':'') + teamDisplayName(home) : '(trống)',
      t1co: home ? [home.p1 && home.p1.company, home.p2 && home.p2.company].filter(Boolean).join(' / ') : '',
      score: matchScoreDisplay(homeScore, awayScore),
      t2: away ? (winAway?'👑 ':'') + teamDisplayName(away) : '(trống)',
      t2co: away ? [away.p1 && away.p1.company, away.p2 && away.p2.company].filter(Boolean).join(' / ') : '',
      g2: groupName(awayGroup),
      status: matchStatusLabel(isDone),
      _isDone: isDone,
      _win1: winHome, _win2: winAway,
    };
  });
}

async function exportMatchesToExcel(){
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

    const realMatches = STATE.matches.filter(m => !m.empty);
    // Sắp đúng thứ tự thi đấu thật: Lượt đấu trước, rồi tới Sân — dùng
    // chung cho mọi tab để mỗi tab đều đọc theo đúng trình tự thời gian.
    const sorted = realMatches.slice().sort((a, b) =>
      (roundNum(a.time) - roundNum(b.time)) || ((Number(a.court) || 0) - (Number(b.court) || 0))
    );

    // ---- Tab "Tất cả" ----
    const allRows = matchesExportRowsAll(sorted);
    writeMatchSheet(
      wb, 'Tất cả',
      'BMT MATERIAL PICKLEBALL 2026 - KỶ NIỆM 15 NĂM THÀNH LẬP CÔNG TY — LỊCH THI ĐẤU & TỶ SỐ (TẤT CẢ)',
      matchesExportSubtitle(allRows),
      MATCHES_EXPORT_COLS_ALL,
      allRows
    );

    // ---- 1 tab riêng cho mỗi Bảng A-F ----
    GROUPS.forEach(g => {
      const rows = matchesExportRowsForGroup(sorted, g);
      writeMatchSheet(
        wb, `Bảng ${g}`,
        `LỊCH THI ĐẤU — ${groupName(g).toUpperCase()}`,
        matchesExportSubtitle(rows),
        MATCHES_EXPORT_COLS_GROUP,
        rows
      );
    });

    // ---- Xuất file ----
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `BMT_Pickleball_LichThiDau_${ts}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    showToast('Đã xuất file Excel Lịch thi đấu (7 tab: Tất cả + 6 bảng) thành công', 'success');
  }catch(err){
    console.error('Lỗi xuất Excel lịch thi đấu:', err);
    showToast('Xuất Excel thất bại: ' + (err && err.message ? err.message : String(err)), 'error');
  }
}
