/**
 * Storage Module: Quản lý lưu trữ LocalStorage, dữ liệu mẫu, Import/Export
 */

const STORAGE_KEY = 'habit_matrix_data_v1';
const THEME_KEY = 'habit_matrix_theme';
const SOUND_KEY = 'habit_matrix_sound';

// Danh mục mặc định
export const DEFAULT_CATEGORIES = [
  'Tất cả',
  'Sức khỏe',
  'Học tập',
  'Công việc',
  'Đời sống',
  'Tài chính'
];

/**
 * Sinh dữ liệu mẫu khởi tạo ấn tượng khi người dùng mở lần đầu
 */
export function getInitialSeedData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const today = now.getDate();

  const activities = [];

  // Khởi tạo một số ngày đã hoàn thành ngẫu nhiên thực tế từ ngày 1 đến hôm nay
  const checks = {};
  for (let day = 1; day <= today; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${month}-${dayStr}`;

    activities.forEach((act, idx) => {
      // Xác suất hoàn thành khoảng 65-85% để trông tự nhiên
      const isCompleted = ((day * 7 + idx * 13) % 10) < 7;
      if (isCompleted) {
        checks[`${act.id}:${dateKey}`] = true;
      }
    });
  }

  return { activities, checks };
}

/**
 * Tải dữ liệu từ LocalStorage
 */
export function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const initial = getInitialSeedData();
      saveData(initial);
      return initial;
    }
    const parsed = JSON.parse(saved);
    if (!parsed.activities || !Array.isArray(parsed.activities)) {
      throw new Error('Dữ liệu không đúng định dạng');
    }
    if (!parsed.checks || typeof parsed.checks !== 'object') {
      parsed.checks = {};
    }
    return parsed;
  } catch (e) {
    console.warn('Lỗi đọc localStorage, sử dụng dữ liệu mẫu:', e);
    const initial = getInitialSeedData();
    saveData(initial);
    return initial;
  }
}

/**
 * Lưu dữ liệu vào LocalStorage
 */
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Không thể lưu vào localStorage:', e);
  }
}

/**
 * Reset dữ liệu về ban đầu
 */
export function resetData() {
  const initial = getInitialSeedData();
  saveData(initial);
  return initial;
}

/**
 * Xóa sạch dữ liệu
 */
export function clearAllData() {
  const empty = { activities: [], checks: {} };
  saveData(empty);
  return empty;
}

/**
 * Tùy chọn âm thanh & Theme
 */
export function loadPreferences() {
  const theme = localStorage.getItem(THEME_KEY) || 'dark';
  const sound = localStorage.getItem(SOUND_KEY) !== 'false'; // default true
  return { theme, sound };
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

export function saveSound(enabled) {
  localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
}

/**
 * Xuất dữ liệu dưới dạng JSON download
 */
export function exportDataAsJSON(data) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `activity_matrix_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Nhập dữ liệu từ file JSON
 */
export function importDataFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.activities || !Array.isArray(parsed.activities)) {
          return reject(new Error('File JSON không hợp lệ: thiếu danh sách activities'));
        }
        if (!parsed.checks) parsed.checks = {};
        saveData(parsed);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Lỗi giải mã file JSON: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file'));
    reader.readAsText(file);
  });
}

/**
 * Xuất dữ liệu bảng của tháng hiện tại ra định dạng CSV (Excel)
 */
export function exportDataAsCSV(activities, checks, year, month, daysInMonth) {
  const monthStr = String(month).padStart(2, '0');
  
  // Header: Hoạt động, Danh mục, Ngày 1, Ngày 2, ..., Tổng hoàn thành, Tỷ lệ %
  const headers = ['"Hoạt động"', '"Danh mục"'];
  for (let d = 1; d <= daysInMonth; d++) {
    headers.push(`"Ngày ${d}"`);
  }
  headers.push('"Tổng đạt"', '"Tỷ lệ %"');

  const rows = [headers.join(',')];

  activities.forEach(act => {
    let completedCount = 0;
    const row = [`"${act.name.replace(/"/g, '""')}"`, `"${act.category || ''}"`];

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dStr}`;
      const isDone = checks[`${act.id}:${dateKey}`];
      if (isDone) {
        completedCount++;
        row.push('"X"');
      } else {
        row.push('""');
      }
    }

    const rate = Math.round((completedCount / daysInMonth) * 100);
    row.push(`"${completedCount}"`, `"${rate}%"`);
    rows.push(row.join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n'); // Thêm BOM UTF-8 cho Excel tiếng Việt
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `activity_matrix_${year}_${monthStr}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
