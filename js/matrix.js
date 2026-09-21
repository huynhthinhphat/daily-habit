/**
 * Matrix View Module: Render và tương tác với Bảng Ma Trận Checkbox
 */

import { toggleActivityCheck, playCheckSound, updateActivity, deleteActivity } from './tracker.js';

const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Lấy số ngày trong một tháng
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Lấy thứ trong tuần (0 = Chủ Nhật, 1 = Thứ Hai, ...)
 */
export function getWeekday(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

/**
 * Render toàn bộ ma trận (Thead, Tbody, Tfoot)
 */
export function renderMatrix(state, year, month, options = {}) {
  const {
    filterCategory = 'Tất cả',
    searchQuery = '',
    soundEnabled = true,
    onStatsUpdate = () => {}
  } = options;

  const thead = document.getElementById('matrix-thead');
  const tbody = document.getElementById('matrix-tbody');
  const tfoot = document.getElementById('matrix-tfoot');

  const daysInMonth = getDaysInMonth(year, month);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const isCurrentViewingMonth = (year === currentYear && month === currentMonth);

  // 1. Render THEAD
  renderThead(thead, year, month, daysInMonth, isCurrentViewingMonth, currentDay);

  // Lọc danh sách hoạt động
  const filteredActivities = state.activities.filter(act => {
    const matchCategory = filterCategory === 'Tất cả' || act.category === filterCategory;
    const matchSearch = !searchQuery || act.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // 2. Render TBODY
  renderTbody(tbody, state, filteredActivities, year, month, daysInMonth, isCurrentViewingMonth, currentDay, {
    soundEnabled,
    onStateChange: () => {
      // Cập nhật lại thanh tiến độ và tfoot
      updateAllProgressDisplays(state, year, month, daysInMonth);
      onStatsUpdate();
    },
    onActivityRename: (actId, newName) => {
      updateActivity(state, actId, { name: newName });
      onStatsUpdate();
    },
    onActivityDelete: (actId) => {
      deleteActivity(state, actId);
      renderMatrix(state, year, month, options);
      onStatsUpdate();
    }
  });

  // 3. Render TFOOT
  renderTfoot(tfoot, state, year, month, daysInMonth, isCurrentViewingMonth, currentDay);

  // Gọi update stats ban đầu
  onStatsUpdate();
}

/**
 * Render Header (Hàng ngày và thứ trong tháng)
 */
function renderThead(thead, year, month, daysInMonth, isCurrentViewingMonth, currentDay) {
  let thCells = '';

  for (let day = 1; day <= daysInMonth; day++) {
    const weekdayIdx = getWeekday(year, month, day);
    const weekdayLabel = VIETNAMESE_WEEKDAYS[weekdayIdx];
    const isWeekend = (weekdayIdx === 0 || weekdayIdx === 6);
    const isToday = (isCurrentViewingMonth && day === currentDay);

    const classes = [
      'day-header-cell',
      isWeekend ? 'is-weekend' : '',
      isToday ? 'is-today' : ''
    ].filter(Boolean).join(' ');

    thCells += `
      <th class="${classes}" title="Ngày ${day}/${month}/${year} (${weekdayLabel})">
        <div class="day-header-inner">
          <span class="day-name">${weekdayLabel}</span>
          <span class="day-num">${day}</span>
        </div>
      </th>
    `;
  }

  thead.innerHTML = `
    <tr>
      <th class="corner-header">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Hoạt động / Thói quen</span>
          <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">Tháng ${month}/${year}</span>
        </div>
      </th>
      ${thCells}
      <th class="col-stat-header" title="Thống kê hoàn thành của hoạt động trong tháng">Tổng / %</th>
    </tr>
  `;
}

/**
 * Render Tbody (Các dòng hoạt động và các ô checkbox)
 */
function renderTbody(tbody, state, activities, year, month, daysInMonth, isCurrentViewingMonth, currentDay, handlers) {
  if (activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${daysInMonth + 2}" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;">
              <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <p>Không tìm thấy hoạt động nào phù hợp.</p>
            <button class="btn btn-secondary btn-sm" id="btn-empty-add">+ Thêm hoạt động mới ngay</button>
          </div>
        </td>
      </tr>
    `;
    const btnEmptyAdd = document.getElementById('btn-empty-add');
    if (btnEmptyAdd) {
      btnEmptyAdd.addEventListener('click', () => {
        document.getElementById('btn-add-activity')?.click();
      });
    }
    return;
  }

  const monthStr = String(month).padStart(2, '0');
  let rowsHtml = '';

  activities.forEach(act => {
    let checkCells = '';
    let completedCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      const isChecked = !!state.checks[`${act.id}:${dateKey}`];
      if (isChecked) completedCount++;

      const weekdayIdx = getWeekday(year, month, day);
      const isWeekend = (weekdayIdx === 0 || weekdayIdx === 6);
      const isToday = (isCurrentViewingMonth && day === currentDay);

      const cellClasses = [
        'matrix-cell',
        isWeekend ? 'is-weekend' : '',
        isToday ? 'is-today' : ''
      ].filter(Boolean).join(' ');

      checkCells += `
        <td class="${cellClasses}" data-act-id="${act.id}" data-date="${dateKey}" data-day="${day}">
          <button type="button" 
                  class="matrix-checkbox-btn ${isChecked ? 'is-checked' : ''}" 
                  style="--habit-color: ${act.color}; --habit-glow: ${act.color}40;"
                  aria-label="${act.name} - Ngày ${day}/${month}"
                  title="${act.name} - Ngày ${day}/${month}/${year}: ${isChecked ? 'Đã hoàn thành' : 'Chưa hoàn thành'}">
            <span class="checkbox-box">
              <svg class="checkbox-icon" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </button>
        </td>
      `;
    }

    const rowRate = Math.round((completedCount / daysInMonth) * 100);

    rowsHtml += `
      <tr data-row-act-id="${act.id}">
        <!-- Sticky Activity Info Column -->
        <td class="col-activity-name">
          <div class="activity-row-content">
            <div class="activity-info">
              <span class="activity-indicator" style="background-color: ${act.color}; color: ${act.color};"></span>
              <div class="activity-text-group">
                <span class="activity-title" data-act-id="${act.id}" title="Nhấp đúp để chỉnh sửa tên">${escapeHtml(act.name)}</span>
                <div class="activity-meta">
                  <span class="activity-category-tag">${escapeHtml(act.category || 'Chung')}</span>
                </div>
              </div>
            </div>
            <div class="activity-actions">
              <button type="button" class="action-btn-mini btn-edit" data-act-id="${act.id}" title="Đổi tên">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button type="button" class="action-btn-mini btn-delete" data-act-id="${act.id}" title="Xóa hoạt động">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </td>

        <!-- Days Checkboxes -->
        ${checkCells}

        <!-- Sticky Right Stat Column -->
        <td class="col-stat-cell" id="row-stat-${act.id}">
          <div class="row-progress-display">
            <span class="row-progress-label">${completedCount}/${daysInMonth} (${rowRate}%)</span>
            <div class="row-progress-bar-bg">
              <div class="row-progress-bar-fill" style="width: ${rowRate}%; background: ${act.color};"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;

  // Gắn sự kiện click vào từng ô checkbox
  tbody.querySelectorAll('.matrix-checkbox-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const td = btn.closest('td');
      const actId = td.dataset.actId;
      const dateStr = td.dataset.date;
      const day = parseInt(td.dataset.day, 10);

      const nextChecked = toggleActivityCheck(state, actId, dateStr);

      if (nextChecked) {
        btn.classList.add('is-checked');
        const box = btn.querySelector('.checkbox-box');
        box.classList.add('animate-bounce');
        setTimeout(() => box.classList.remove('animate-bounce'), 300);
      } else {
        btn.classList.remove('is-checked');
      }

      // Phát âm thanh nếu đang bật
      if (handlers.soundEnabled) {
        playCheckSound(nextChecked);
      }

      // Cập nhật tooltip
      const act = state.activities.find(a => a.id === actId);
      if (act) {
        btn.setAttribute('title', `${act.name} - Ngày ${day}/${month}/${year}: ${nextChecked ? 'Đã hoàn thành' : 'Chưa hoàn thành'}`);
      }

      handlers.onStateChange();
    });
  });

  // Gắn sự kiện sửa inline (Double click vào tiêu đề)
  tbody.querySelectorAll('.activity-title').forEach(titleEl => {
    titleEl.addEventListener('dblclick', () => {
      startInlineEdit(titleEl, handlers.onActivityRename);
    });
  });

  // Nút bút chì Edit
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const actId = btn.dataset.actId;
      const titleEl = tbody.querySelector(`.activity-title[data-act-id="${actId}"]`);
      if (titleEl) startInlineEdit(titleEl, handlers.onActivityRename);
    });
  });

  // Nút xóa Delete
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const actId = btn.dataset.actId;
      const act = state.activities.find(a => a.id === actId);
      if (act && confirm(`Bạn có chắc muốn xóa hoạt động "${act.name}" không?`)) {
        handlers.onActivityDelete(actId);
      }
    });
  });
}

/**
 * Xử lý chỉnh sửa tên inline trực tiếp trong ô cột bên trái
 */
function startInlineEdit(titleEl, onSave) {
  const currentText = titleEl.textContent;
  const actId = titleEl.dataset.actId;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'activity-inline-input';
  input.value = currentText;

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let isSaved = false;

  const save = () => {
    if (isSaved) return;
    isSaved = true;
    const newText = input.value.trim() || currentText;
    titleEl.textContent = newText;
    input.replaceWith(titleEl);
    if (newText !== currentText) {
      onSave(actId, newText);
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      isSaved = true;
      input.replaceWith(titleEl);
    }
  });
}

/**
 * Render Tfoot (Hàng tổng kết cuối bảng)
 */
function renderTfoot(tfoot, state, year, month, daysInMonth, isCurrentViewingMonth, currentDay) {
  const monthStr = String(month).padStart(2, '0');
  const totalActs = state.activities.length;
  let cellsHtml = '';
  let monthTotal = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    let completed = 0;
    state.activities.forEach(act => {
      if (state.checks[`${act.id}:${dateKey}`]) completed++;
    });

    monthTotal += completed;
    const rate = totalActs > 0 ? Math.round((completed / totalActs) * 100) : 0;
    const isToday = (isCurrentViewingMonth && day === currentDay);

    cellsHtml += `
      <td class="day-summary-cell ${isToday ? 'is-today' : ''}" id="tfoot-day-${day}">
        <span class="day-summary-count">${completed}</span>
        <span class="day-summary-rate">${rate}%</span>
      </td>
    `;
  }

  const overallMax = totalActs * daysInMonth;
  const overallRate = overallMax > 0 ? Math.round((monthTotal / overallMax) * 100) : 0;

  tfoot.innerHTML = `
    <tr>
      <td class="corner-footer">Tổng số việc xong trong ngày</td>
      ${cellsHtml}
      <td class="col-stat-cell" id="tfoot-total-summary">
        <div class="row-progress-display">
          <span class="row-progress-label">${monthTotal} lượt</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">${overallRate}% cả tháng</span>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Cập nhật động số liệu hàng và chân bảng khi tick mà không phải re-render lại toàn bộ DOM bảng
 */
export function updateAllProgressDisplays(state, year, month, daysInMonth) {
  const monthStr = String(month).padStart(2, '0');
  const totalActs = state.activities.length;
  let monthTotal = 0;

  // 1. Cập nhật row stats
  state.activities.forEach(act => {
    let completed = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      if (state.checks[`${act.id}:${dateKey}`]) completed++;
    }

    const rate = Math.round((completed / daysInMonth) * 100);
    const rowStatEl = document.getElementById(`row-stat-${act.id}`);
    if (rowStatEl) {
      rowStatEl.innerHTML = `
        <div class="row-progress-display">
          <span class="row-progress-label">${completed}/${daysInMonth} (${rate}%)</span>
          <div class="row-progress-bar-bg">
            <div class="row-progress-bar-fill" style="width: ${rate}%; background: ${act.color};"></div>
          </div>
        </div>
      `;
    }
  });

  // 2. Cập nhật tfoot daily summary
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    let completed = 0;
    state.activities.forEach(act => {
      if (state.checks[`${act.id}:${dateKey}`]) completed++;
    });

    monthTotal += completed;
    const rate = totalActs > 0 ? Math.round((completed / totalActs) * 100) : 0;

    const cell = document.getElementById(`tfoot-day-${day}`);
    if (cell) {
      cell.querySelector('.day-summary-count').textContent = completed;
      cell.querySelector('.day-summary-rate').textContent = `${rate}%`;
    }
  }

  // 3. Cập nhật overall summary
  const totalSummaryEl = document.getElementById('tfoot-total-summary');
  if (totalSummaryEl) {
    const overallMax = totalActs * daysInMonth;
    const overallRate = overallMax > 0 ? Math.round((monthTotal / overallMax) * 100) : 0;
    totalSummaryEl.innerHTML = `
      <div class="row-progress-display">
        <span class="row-progress-label">${monthTotal} lượt</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">${overallRate}% cả tháng</span>
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
