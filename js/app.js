/**
 * Daily Habit & Activity Matrix - Core Application
 * Thiết kế độc lập, hoạt động trơn tru cả khi mở trực tiếp file:/// và trên server http://
 * Đặc biệt: Riêng Tháng 9/2026 bắt đầu từ ngày hôm nay (21/09) trở đi.
 */

(function () {
  'use strict';

  // --- HẰNG SỐ & CONFIG ---
  const STORAGE_KEY = 'habit_matrix_data_v1';
  const THEME_KEY = 'habit_matrix_theme';
  const SOUND_KEY = 'habit_matrix_sound';
  const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // Cột mốc bắt đầu kế hoạch: 21/09/2026
  const PLAN_START_YEAR = 2026;
  const PLAN_START_MONTH = 9;
  const PLAN_START_DAY = 21;

  const DEFAULT_CATEGORIES = [
    'Tất cả',
    'Sức khỏe',
    'Học tập',
    'Công việc',
    'Đời sống',
    'Tài chính'
  ];

  // --- TRẠNG THÁI ỨNG DỤNG ---
  const state = {
    data: null,
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth() + 1, // 1 - 12
    selectedCategory: 'Tất cả',
    searchQuery: '',
    soundEnabled: true,
    theme: 'dark',
    dayRange: 'from-today' // 'from-today', 'all', 'first', 'second'
  };

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCheckSound(isChecked) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (isChecked) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      // Ignored
    }
  }

  // --- TÍNH TOÁN NGÀY THÁNG CHUẨN XÁC ---
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getWeekday(year, month, day) {
    return new Date(year, month - 1, day).getDay();
  }

  /**
   * Xác định ngày bắt đầu tính cho một tháng
   * Riêng tháng 9/2026: bắt đầu từ ngày hôm nay (21)
   * Các tháng khác: bắt đầu từ ngày 1
   */
  function getMonthPlanStartDay(year, month) {
    if (year === PLAN_START_YEAR && month === PLAN_START_MONTH) {
      return PLAN_START_DAY; // 21
    }
    return 1;
  }

  // --- DỮ LIỆU MẪU & LOCALSTORAGE ---
  function getInitialSeedData() {
    const activities = [
      {
        id: 'act_1',
        name: '🏃 Chạy bộ / Đi bộ 5,000 bước',
        category: 'Sức khỏe',
        color: '#10b981',
        desc: 'Rèn luyện sức bền và tim mạch mỗi sáng'
      },
      {
        id: 'act_2',
        name: '📖 Đọc sách phát triển bản thân 30p',
        category: 'Học tập',
        color: '#6366f1',
        desc: 'Đọc tối thiểu 15-20 trang sách mỗi ngày'
      },
      {
        id: 'act_3',
        name: '💧 Uống đủ 2 Lít nước',
        category: 'Sức khỏe',
        color: '#06b6d4',
        desc: 'Chia đều uống nước ấm trong ngày'
      },
      {
        id: 'act_4',
        name: '🇬🇧 Học 15 từ vựng tiếng Anh',
        category: 'Học tập',
        color: '#8b5cf6',
        desc: 'Học qua flashcard và làm bài tập ngắn'
      },
      {
        id: 'act_5',
        name: '💻 Deep Work 2 tiếng không xao nhãng',
        category: 'Công việc',
        color: '#f59e0b',
        desc: 'Tắt thông báo điện thoại, tập trung việc quan trọng'
      },
      {
        id: 'act_6',
        name: '🧘 Thiền định 10 phút & Viết nhật ký',
        category: 'Đời sống',
        color: '#ec4899',
        desc: 'Ghi lại 3 điều biết ơn trong ngày'
      },
      {
        id: 'act_7',
        name: '😴 Đi ngủ trước 23h00',
        category: 'Sức khỏe',
        color: '#ef4444',
        desc: 'Không dùng màn hình xanh trước khi ngủ 30 phút'
      }
    ];

    // Bắt đầu từ ngày hôm nay (21/09) trở đi, chưa có check cũ
    const checks = {};
    const notes = {};

    return { activities, checks, notes };
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const initial = getInitialSeedData();
        saveData(initial);
        return initial;
      }
      const parsed = JSON.parse(saved);
      if (!parsed.activities || !Array.isArray(parsed.activities)) {
        throw new Error('Dữ liệu lỗi định dạng');
      }
      if (!parsed.checks || typeof parsed.checks !== 'object') {
        parsed.checks = {};
      }
      if (!parsed.notes || typeof parsed.notes !== 'object') {
        parsed.notes = {};
      }

      // Xóa bỏ mọi dữ liệu trước ngày 21/09/2026 trong tháng 9 để đảm bảo bắt đầu từ hôm nay
      Object.keys(parsed.checks).forEach(k => {
        const parts = k.split(':');
        if (parts.length === 2 && parts[1].startsWith('2026-09-')) {
          const dayNum = parseInt(parts[1].split('-')[2], 10);
          if (dayNum < PLAN_START_DAY) {
            delete parsed.checks[k];
          }
        }
      });
      Object.keys(parsed.notes).forEach(k => {
        const parts = k.split(':');
        if (parts.length === 2 && parts[1].startsWith('2026-09-')) {
          const dayNum = parseInt(parts[1].split('-')[2], 10);
          if (dayNum < PLAN_START_DAY) {
            delete parsed.notes[k];
          }
        }
      });

      return parsed;
    } catch (e) {
      console.warn('Khởi tạo lại dữ liệu mẫu:', e);
      const initial = getInitialSeedData();
      saveData(initial);
      return initial;
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      triggerCloudSync(); // Tự động đồng bộ lên Cloud Supabase nếu đã kết nối
    } catch (e) {
      console.error('Lỗi khi lưu localStorage:', e);
    }
  }

  // --- NGHIỆP VỤ HOẠT ĐỘNG (TRACKER) ---
  function addActivity({ name, category, color, desc }) {
    const newActivity = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      category: category || 'Sức khỏe',
      color: color || '#6366f1',
      desc: desc ? desc.trim() : '',
      createdAt: new Date().toISOString()
    };

    state.data.activities.push(newActivity);
    saveData(state.data);
    return newActivity;
  }

  function updateActivity(activityId, updates) {
    const act = state.data.activities.find(a => a.id === activityId);
    if (!act) return;
    Object.assign(act, updates);
    saveData(state.data);
  }

  function deleteActivity(activityId) {
    state.data.activities = state.data.activities.filter(a => a.id !== activityId);
    Object.keys(state.data.checks).forEach(key => {
      if (key.startsWith(activityId + ':')) delete state.data.checks[key];
    });
    if (state.data.notes) {
      Object.keys(state.data.notes).forEach(key => {
        if (key.startsWith(activityId + ':')) delete state.data.notes[key];
      });
    }
    saveData(state.data);
  }

  function toggleActivityCheck(activityId, dateStr) {
    const key = `${activityId}:${dateStr}`;
    const nextState = !state.data.checks[key];
    if (nextState) {
      state.data.checks[key] = true;
    } else {
      delete state.data.checks[key];
    }
    saveData(state.data);
    return nextState;
  }

  // --- TÍNH TOÁN TOÀN BỘ THỐNG KÊ THÁNG ---
  function calculateMonthStats(year, month, daysInMonth) {
    const monthStr = String(month).padStart(2, '0');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const todayDate = now.getDate();
    const isCurrentViewingMonth = (year === currentYear && month === currentMonth);
    const totalActivities = state.data.activities.length;

    // Xác định ngày bắt đầu tính mục tiêu cho tháng
    const planStartDay = getMonthPlanStartDay(year, month);
    const totalTargetDays = daysInMonth - planStartDay + 1; // 10 ngày cho tháng 9, 31 ngày cho tháng 10...

    const dailyStats = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dStr}`;
      let completed = 0;

      state.data.activities.forEach(act => {
        if (state.data.checks[`${act.id}:${dateKey}`]) {
          completed++;
        }
      });

      const rate = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;
      dailyStats[d] = { completed, total: totalActivities, rate };
    }

    let overallBestStreak = 0;
    let bestHabitName = 'Chưa có';

    state.data.activities.forEach(act => {
      let completedDays = 0;
      let maxStreak = 0;
      let tempStreak = 0;
      const endDay = isCurrentViewingMonth ? todayDate : daysInMonth;

      for (let d = planStartDay; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dStr}`;
        const isDone = !!state.data.checks[`${act.id}:${dateKey}`];

        if (isDone) {
          completedDays++;
          if (d <= endDay) {
            tempStreak++;
            if (tempStreak > maxStreak) maxStreak = tempStreak;
          }
        } else {
          if (d <= endDay) tempStreak = 0;
        }
      }

      if (maxStreak > overallBestStreak) {
        overallBestStreak = maxStreak;
        bestHabitName = act.name;
      }
    });

    let todayRate = 0;
    let todayCount = 0;
    if (isCurrentViewingMonth && dailyStats[todayDate]) {
      todayCount = dailyStats[todayDate].completed;
      todayRate = dailyStats[todayDate].rate;
    }

    // Tính tổng hoàn thành từ ngày bắt đầu kế hoạch
    let monthTotalChecks = 0;
    for (let d = planStartDay; d <= daysInMonth; d++) {
      monthTotalChecks += dailyStats[d].completed;
    }
    const monthMaxPossible = totalActivities * totalTargetDays;
    const monthRate = monthMaxPossible > 0 ? Math.round((monthTotalChecks / monthMaxPossible) * 100) : 0;

    return {
      todayRate,
      todayCount,
      totalActivities,
      monthRate,
      monthTotalChecks,
      totalTargetDays,
      planStartDay,
      overallBestStreak,
      bestHabitName,
      dailyStats
    };
  }

  // --- RENDER BẢNG MA TRẬN ĐẦY ĐỦ CÁC NGÀY ---
  function renderMatrix() {
    const year = state.viewYear;
    const month = state.viewMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const monthStr = String(month).padStart(2, '0');
    const isSep2026 = (year === PLAN_START_YEAR && month === PLAN_START_MONTH);
    const planStartDay = getMonthPlanStartDay(year, month);

    // Cập nhật nhãn số ngày trên header
    const badgeMonthDays = document.getElementById('badge-month-days');
    if (badgeMonthDays) {
      if (isSep2026) {
        badgeMonthDays.className = 'badge-month-days badge-start-today';
        badgeMonthDays.textContent = `🚀 Tháng 9: Bắt đầu từ hôm nay (21/09 - 30/09 • 10 ngày)`;
      } else {
        badgeMonthDays.className = 'badge-month-days';
        badgeMonthDays.textContent = `Đầy đủ ${daysInMonth} ngày (01/${monthStr} - ${daysInMonth}/${monthStr})`;
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const isCurrentViewingMonth = (year === currentYear && month === currentMonth);

    // Xác định phạm vi ngày hiển thị
    let startDay = 1;
    let endDay = daysInMonth;

    if (isSep2026) {
      // Đối với Tháng 9/2026: mặc định hiển thị từ ngày hôm nay (21) trở đi
      if (state.dayRange === 'all') {
        startDay = 1;
        endDay = 30;
      } else {
        // Mặc định hoặc 'from-today'
        startDay = PLAN_START_DAY; // 21
        endDay = 30;
      }
    } else {
      // Các tháng khác
      if (state.dayRange === 'first') {
        endDay = Math.min(15, daysInMonth);
      } else if (state.dayRange === 'second') {
        startDay = 16;
      }
    }

    // Cập nhật lại các nút filter ngày trên toolbar tương ứng với tháng
    renderDayRangeButtons(isSep2026);

    const thead = document.getElementById('matrix-thead');
    const tbody = document.getElementById('matrix-tbody');
    const tfoot = document.getElementById('matrix-tfoot');

    // 1. RENDER THEAD
    let thCells = '';
    for (let day = startDay; day <= endDay; day++) {
      const weekdayIdx = getWeekday(year, month, day);
      const weekdayLabel = VIETNAMESE_WEEKDAYS[weekdayIdx];
      const isWeekend = (weekdayIdx === 0 || weekdayIdx === 6);
      const isToday = (isCurrentViewingMonth && day === currentDay);
      const isPrior = (isSep2026 && day < PLAN_START_DAY);

      const classes = [
        'day-header-cell',
        isWeekend ? 'is-weekend' : '',
        isToday ? 'is-today' : '',
        isPrior ? 'is-prior-to-start' : ''
      ].filter(Boolean).join(' ');

      const titleAttr = isPrior 
        ? `Ngày ${day}/${month}/${year} (${weekdayLabel}) - Trước ngày bắt đầu kế hoạch`
        : `Ngày ${day}/${month}/${year} (${weekdayLabel})`;

      thCells += `
        <th class="${classes}" title="${titleAttr}">
          <div class="day-header-inner">
            <span class="day-name">${weekdayLabel}</span>
            <span class="day-num">${String(day).padStart(2, '0')}</span>
          </div>
        </th>
      `;
    }

    const targetDaysInMonth = isSep2026 ? (daysInMonth - PLAN_START_DAY + 1) : daysInMonth;
    thead.innerHTML = `
      <tr>
        <th class="corner-header">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Hoạt động (${state.data.activities.length})</span>
            <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">
              ${isSep2026 ? '21 - 30/09 (10 ngày)' : `Tháng ${month}/${year}`}
            </span>
          </div>
        </th>
        ${thCells}
        <th class="col-stat-header" title="Thống kê hoàn thành mục tiêu tháng">Tổng / %</th>
      </tr>
    `;

    // Lọc danh sách hoạt động
    const filteredActivities = state.data.activities.filter(act => {
      const matchCat = state.selectedCategory === 'Tất cả' || act.category === state.selectedCategory;
      const matchSearch = !state.searchQuery || act.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    // 2. RENDER TBODY
    if (filteredActivities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${(endDay - startDay + 1) + 2}" style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
              <p>Không có hoạt động nào trong danh mục này.</p>
              <button class="btn btn-primary btn-sm" id="btn-empty-add">+ Thêm hoạt động mới</button>
            </div>
          </td>
        </tr>
      `;
      document.getElementById('btn-empty-add')?.addEventListener('click', () => {
        document.getElementById('btn-add-activity')?.click();
      });
    } else {
      let rowsHtml = '';
      filteredActivities.forEach(act => {
        let checkCells = '';
        let completedInActiveRange = 0;

        // Tính số ngày hoàn thành trong phạm vi kế hoạch
        for (let d = planStartDay; d <= daysInMonth; d++) {
          const dStr = String(d).padStart(2, '0');
          if (state.data.checks[`${act.id}:${year}-${monthStr}-${dStr}`]) {
            completedInActiveRange++;
          }
        }

        // Tạo các ô checkbox theo phạm vi hiển thị
        for (let day = startDay; day <= endDay; day++) {
          const dayStr = String(day).padStart(2, '0');
          const dateKey = `${year}-${monthStr}-${dayStr}`;
          const isChecked = !!state.data.checks[`${act.id}:${dateKey}`];
          const hasNote = !!(state.data.notes && state.data.notes[`${act.id}:${dateKey}`]);
          const noteText = hasNote ? state.data.notes[`${act.id}:${dateKey}`] : '';

          const weekdayIdx = getWeekday(year, month, day);
          const isWeekend = (weekdayIdx === 0 || weekdayIdx === 6);
          const isToday = (isCurrentViewingMonth && day === currentDay);
          const isPrior = (isSep2026 && day < PLAN_START_DAY);

          const cellClasses = [
            'matrix-cell',
            hasNote ? 'has-note' : '',
            isWeekend ? 'is-weekend' : '',
            isToday ? 'is-today' : '',
            isPrior ? 'is-prior-to-start' : ''
          ].filter(Boolean).join(' ');

          const tooltip = isPrior 
            ? `${act.name} - Ngày ${day}/${month}/${year} (Trước ngày bắt đầu 21/09)`
            : `${act.name} - Ngày ${day}/${month}/${year}: ${isChecked ? 'Đã hoàn thành' : 'Chưa hoàn thành'}${hasNote ? ' \n📝 Lý do: ' + noteText : ' (Chuột phải hoặc bấm 💬 để nhập lý do)'}`;

          checkCells += `
            <td class="${cellClasses}" data-act-id="${act.id}" data-date="${dateKey}" data-day="${day}" title="${escapeHtml(tooltip)}">
              ${hasNote ? '<span class="cell-note-dot"></span>' : ''}
              <button type="button" 
                      class="matrix-checkbox-btn ${isChecked ? 'is-checked' : ''}" 
                      style="--habit-color: ${act.color}; --habit-glow: ${act.color}40;"
                      aria-label="${act.name} - Ngày ${day}/${month}">
                <span class="checkbox-box">
                  <svg class="checkbox-icon" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              </button>
              <button type="button" 
                      class="cell-note-btn" 
                      data-act-id="${act.id}" 
                      data-date="${dateKey}" 
                      data-day="${day}" 
                      title="${hasNote ? 'Sửa lý do: ' + escapeHtml(noteText) : 'Nhấp để nhập lý do / ghi chú'}">💬</button>
            </td>
          `;
        }

        const rowRate = Math.round((completedInActiveRange / targetDaysInMonth) * 100);

        rowsHtml += `
          <tr data-row-act-id="${act.id}">
            <td class="col-activity-name">
              <div class="activity-row-content">
                <div class="activity-info">
                  <span class="activity-indicator" style="background-color: ${act.color}; color: ${act.color};"></span>
                  <div class="activity-text-group">
                    <span class="activity-title" data-act-id="${act.id}" title="Nhấp đúp để sửa tên">${escapeHtml(act.name)}</span>
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

            ${checkCells}

            <td class="col-stat-cell" id="row-stat-${act.id}">
              <div class="row-progress-display">
                <span class="row-progress-label">${completedInActiveRange}/${targetDaysInMonth} (${rowRate}%)</span>
                <div class="row-progress-bar-bg">
                  <div class="row-progress-bar-fill" style="width: ${rowRate}%; background: ${act.color};"></div>
                </div>
              </div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = rowsHtml;
      bindTableInteractions();
    }

    // 3. RENDER TFOOT
    let footCells = '';
    const totalActs = state.data.activities.length;
    let monthTotalCompleted = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      let completed = 0;
      state.data.activities.forEach(act => {
        if (state.data.checks[`${act.id}:${dateKey}`]) completed++;
      });
      if (day >= planStartDay) {
        monthTotalCompleted += completed;
      }

      if (day >= startDay && day <= endDay) {
        const rate = totalActs > 0 ? Math.round((completed / totalActs) * 100) : 0;
        const isToday = (isCurrentViewingMonth && day === currentDay);
        const isPrior = (isSep2026 && day < PLAN_START_DAY);

        footCells += `
          <td class="day-summary-cell ${isToday ? 'is-today' : ''} ${isPrior ? 'is-prior-to-start' : ''}" id="tfoot-day-${day}">
            <span class="day-summary-count">${completed}</span>
            <span class="day-summary-rate">${rate}%</span>
          </td>
        `;
      }
    }

    const overallMax = totalActs * targetDaysInMonth;
    const overallRate = overallMax > 0 ? Math.round((monthTotalCompleted / overallMax) * 100) : 0;

    tfoot.innerHTML = `
      <tr>
        <td class="corner-footer">Tổng hoàn thành theo ngày</td>
        ${footCells}
        <td class="col-stat-cell" id="tfoot-total-summary">
          <div class="row-progress-display">
            <span class="row-progress-label">${monthTotalCompleted} lượt</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${overallRate}% ${isSep2026 ? '(10 ngày)' : 'cả tháng'}</span>
          </div>
        </td>
      </tr>
    `;

    // Cập nhật thống kê trên 4 thẻ đầu trang
    updateDashboardStats(daysInMonth);
  }

  // --- RENDER CÁC NÚT PHẠM VI NGÀY THEO THÁNG ---
  function renderDayRangeButtons(isSep2026) {
    const container = document.getElementById('days-view-container');
    if (!container) return;

    if (isSep2026) {
      const isFromToday = state.dayRange !== 'all';
      container.innerHTML = `
        <button type="button" class="day-range-btn ${isFromToday ? 'active' : ''}" data-range="from-today" title="Bắt đầu từ hôm nay (21/09) đến hết tháng 9">🚀 Từ hôm nay (21 - 30)</button>
        <button type="button" class="day-range-btn ${!isFromToday ? 'active' : ''}" data-range="all" title="Xem đầy đủ cả tháng 9 (ngày 1 - 30)">Xem cả tháng (1 - 30)</button>
      `;
    } else {
      const isAll = state.dayRange === 'all' || state.dayRange === 'from-today';
      const isFirst = state.dayRange === 'first';
      const isSecond = state.dayRange === 'second';
      container.innerHTML = `
        <button type="button" class="day-range-btn ${isAll ? 'active' : ''}" data-range="all" title="Xem đầy đủ cả tháng">📅 Xem Cả Tháng</button>
        <button type="button" class="day-range-btn ${isFirst ? 'active' : ''}" data-range="first" title="Xem ngày 1 đến ngày 15">Ngày 1 - 15</button>
        <button type="button" class="day-range-btn ${isSecond ? 'active' : ''}" data-range="second" title="Xem ngày 16 đến hết tháng">Ngày 16 - Hết</button>
      `;
    }

    container.querySelectorAll('.day-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.dayRange = btn.dataset.range;
        renderMatrix();
      });
    });
  }

  // --- GẮN SỰ KIỆN TƯƠNG TÁC TRONG BẢNG ---
  function bindTableInteractions() {
    const tbody = document.getElementById('matrix-tbody');
    if (!tbody) return;

    // Click checkbox
    tbody.querySelectorAll('.matrix-checkbox-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const td = btn.closest('td');
        const actId = td.dataset.actId;
        const dateStr = td.dataset.date;
        const day = parseInt(td.dataset.day, 10);

        const nextChecked = toggleActivityCheck(actId, dateStr);

        if (nextChecked) {
          btn.classList.add('is-checked');
          const box = btn.querySelector('.checkbox-box');
          box.classList.add('animate-bounce');
          setTimeout(() => box.classList.remove('animate-bounce'), 300);
        } else {
          btn.classList.remove('is-checked');
        }

        playCheckSound(nextChecked);

        // Cập nhật tooltip
        const act = state.data.activities.find(a => a.id === actId);
        const hasNote = !!(state.data.notes && state.data.notes[`${actId}:${dateStr}`]);
        const noteText = hasNote ? state.data.notes[`${actId}:${dateStr}`] : '';
        if (act) {
          td.setAttribute('title', `${act.name} - Ngày ${day}/${state.viewMonth}/${state.viewYear}: ${nextChecked ? 'Đã hoàn thành' : 'Chưa hoàn thành'}${hasNote ? ' \n📝 Lý do: ' + noteText : ' (Chuột phải hoặc bấm 💬 để nhập lý do)'}`);
        }

        // Cập nhật lại số liệu tiến độ
        const daysInMonth = getDaysInMonth(state.viewYear, state.viewMonth);
        updateDynamicStats(daysInMonth);
      });
    });

    // Click vào nút 💬 để mở modal nhập lý do
    tbody.querySelectorAll('.cell-note-btn').forEach(noteBtn => {
      noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const actId = noteBtn.dataset.actId;
        const dateKey = noteBtn.dataset.date;
        const day = parseInt(noteBtn.dataset.day, 10);
        openNoteModal(actId, dateKey, day);
      });
    });

    // Chuột phải (contextmenu) vào ô checkbox để mở nhanh nhập lý do
    tbody.querySelectorAll('.matrix-cell').forEach(cell => {
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const actId = cell.dataset.actId;
        const dateKey = cell.dataset.date;
        const day = parseInt(cell.dataset.day, 10);
        openNoteModal(actId, dateKey, day);
      });
    });

    // Double-click để sửa tên trực tiếp
    tbody.querySelectorAll('.activity-title').forEach(titleEl => {
      titleEl.addEventListener('dblclick', () => {
        startInlineEdit(titleEl);
      });
    });

    // Nút bút chì Edit
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const actId = btn.dataset.actId;
        const titleEl = tbody.querySelector(`.activity-title[data-act-id="${actId}"]`);
        if (titleEl) startInlineEdit(titleEl);
      });
    });

    // Nút xóa
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const actId = btn.dataset.actId;
        const act = state.data.activities.find(a => a.id === actId);
        if (act && confirm(`Bạn có chắc muốn xóa hoạt động "${act.name}" không?`)) {
          deleteActivity(actId);
          renderCategoryFilterChips();
          renderMatrix();
          showToast(`Đã xóa "${act.name}"`);
        }
      });
    });
  }

  // --- SỬA TÊN TRỰC TIẾP (INLINE EDIT) ---
  function startInlineEdit(titleEl) {
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
        updateActivity(actId, { name: newText });
        const daysInMonth = getDaysInMonth(state.viewYear, state.viewMonth);
        updateDashboardStats(daysInMonth);
        showToast('Đã lưu tên mới thành công!');
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

  // --- MODAL NHẬP LÝ DO CHO CHECKBOX ---
  function openNoteModal(actId, dateKey, day) {
    const modal = document.getElementById('note-modal');
    if (!modal) return;

    const act = state.data.activities.find(a => a.id === actId);
    const actName = act ? act.name : 'Hoạt động';

    document.getElementById('note-act-id').value = actId;
    document.getElementById('note-date-key').value = dateKey;

    const subtitleEl = document.getElementById('note-modal-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `${actName} • Ngày ${String(day).padStart(2, '0')}/${String(state.viewMonth).padStart(2, '0')}/${state.viewYear}`;
    }

    const checkStatus = document.getElementById('note-check-status');
    if (checkStatus) {
      checkStatus.checked = !!state.data.checks[`${actId}:${dateKey}`];
    }

    const existingNote = (state.data.notes && state.data.notes[`${actId}:${dateKey}`]) || '';
    const noteInput = document.getElementById('cell-note-input');
    if (noteInput) {
      noteInput.value = existingNote;
    }

    const btnDelete = document.getElementById('btn-note-delete');
    if (btnDelete) {
      btnDelete.style.display = existingNote ? 'block' : 'none';
    }

    modal.classList.add('open');
    setTimeout(() => noteInput?.focus(), 100);
  }

  function bindNoteModalEvents() {
    const modal = document.getElementById('note-modal');
    const form = document.getElementById('note-form');
    const btnClose = document.getElementById('btn-note-modal-close');
    const btnCancel = document.getElementById('btn-note-modal-cancel');
    const btnDelete = document.getElementById('btn-note-delete');
    const noteInput = document.getElementById('cell-note-input');

    const closeModal = () => modal.classList.remove('open');

    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!noteInput) return;
        const text = btn.dataset.text;
        if (!noteInput.value.trim()) {
          noteInput.value = text;
        } else {
          noteInput.value = noteInput.value.trim() + ' • ' + text;
        }
        noteInput.focus();
      });
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const actId = document.getElementById('note-act-id').value;
      const dateKey = document.getElementById('note-date-key').value;
      const noteText = noteInput.value.trim();
      const isChecked = document.getElementById('note-check-status').checked;

      if (isChecked) {
        state.data.checks[`${actId}:${dateKey}`] = true;
      } else {
        delete state.data.checks[`${actId}:${dateKey}`];
      }

      state.data.notes = state.data.notes || {};
      if (noteText) {
        state.data.notes[`${actId}:${dateKey}`] = noteText;
      } else {
        delete state.data.notes[`${actId}:${dateKey}`];
      }

      saveData(state.data);
      closeModal();
      renderMatrix();
      showToast('Đã lưu ghi chú & lý do!', 'success');
    });

    btnDelete?.addEventListener('click', () => {
      const actId = document.getElementById('note-act-id').value;
      const dateKey = document.getElementById('note-date-key').value;

      if (state.data.notes && state.data.notes[`${actId}:${dateKey}`]) {
        delete state.data.notes[`${actId}:${dateKey}`];
        saveData(state.data);
        closeModal();
        renderMatrix();
        showToast('Đã xóa lý do của ngày này');
      }
    });

    noteInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  // --- CẬP NHẬT ĐỘNG TIẾN ĐỘ KHI TICK ---
  function updateDynamicStats(daysInMonth) {
    const year = state.viewYear;
    const month = state.viewMonth;
    const monthStr = String(month).padStart(2, '0');
    const totalActs = state.data.activities.length;
    const planStartDay = getMonthPlanStartDay(year, month);
    const targetDays = (year === PLAN_START_YEAR && month === PLAN_START_MONTH) 
      ? (daysInMonth - PLAN_START_DAY + 1) 
      : daysInMonth;

    let monthTotal = 0;

    // 1. Cập nhật row stats
    state.data.activities.forEach(act => {
      let completed = 0;
      for (let day = planStartDay; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        if (state.data.checks[`${act.id}:${year}-${monthStr}-${dayStr}`]) completed++;
      }
      const rate = Math.round((completed / targetDays) * 100);
      const rowStatEl = document.getElementById(`row-stat-${act.id}`);
      if (rowStatEl) {
        rowStatEl.innerHTML = `
          <div class="row-progress-display">
            <span class="row-progress-label">${completed}/${targetDays} (${rate}%)</span>
            <div class="row-progress-bar-bg">
              <div class="row-progress-bar-fill" style="width: ${rate}%; background: ${act.color};"></div>
            </div>
          </div>
        `;
      }
    });

    // 2. Cập nhật tfoot từng ngày
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      let completed = 0;
      state.data.activities.forEach(act => {
        if (state.data.checks[`${act.id}:${year}-${monthStr}-${dayStr}`]) completed++;
      });
      if (day >= planStartDay) monthTotal += completed;

      const rate = totalActs > 0 ? Math.round((completed / totalActs) * 100) : 0;
      const cell = document.getElementById(`tfoot-day-${day}`);
      if (cell) {
        cell.querySelector('.day-summary-count').textContent = completed;
        cell.querySelector('.day-summary-rate').textContent = `${rate}%`;
      }
    }

    // 3. Cập nhật tổng kết tháng
    const totalSummaryEl = document.getElementById('tfoot-total-summary');
    if (totalSummaryEl) {
      const overallMax = totalActs * targetDays;
      const overallRate = overallMax > 0 ? Math.round((monthTotal / overallMax) * 100) : 0;
      const isSep2026 = (year === PLAN_START_YEAR && month === PLAN_START_MONTH);
      totalSummaryEl.innerHTML = `
        <div class="row-progress-display">
          <span class="row-progress-label">${monthTotal} lượt</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">${overallRate}% ${isSep2026 ? '(10 ngày)' : 'cả tháng'}</span>
        </div>
      `;
    }

    updateDashboardStats(daysInMonth);
  }

  // --- CẬP NHẬT 4 THẺ THỐNG KÊ TRÊN CÙNG ---
  function updateDashboardStats(daysInMonth) {
    const stats = calculateMonthStats(state.viewYear, state.viewMonth, daysInMonth);

    // 1. Hôm nay
    const todayRateEl = document.getElementById('stat-today-rate');
    const todayCountEl = document.getElementById('stat-today-count');
    const todayBarEl = document.getElementById('stat-today-bar');
    if (todayRateEl) todayRateEl.textContent = `${stats.todayRate}%`;
    if (todayCountEl) todayCountEl.textContent = `${stats.todayCount}/${stats.totalActivities} việc`;
    if (todayBarEl) todayBarEl.style.width = `${stats.todayRate}%`;

    // 2. Cả tháng (Tính trên các ngày bắt đầu kế hoạch)
    const monthRateEl = document.getElementById('stat-month-rate');
    const monthCountEl = document.getElementById('stat-month-count');
    const monthBarEl = document.getElementById('stat-month-bar');
    if (monthRateEl) monthRateEl.textContent = `${stats.monthRate}%`;
    if (monthCountEl) {
      const isSep2026 = (state.viewYear === PLAN_START_YEAR && state.viewMonth === PLAN_START_MONTH);
      monthCountEl.textContent = `${stats.monthTotalChecks} lượt (${isSep2026 ? 'tính 10 ngày từ 21-30/09' : stats.totalTargetDays + ' ngày'})`;
    }
    if (monthBarEl) monthBarEl.style.width = `${stats.monthRate}%`;

    // 3. Chuỗi dài nhất
    const bestStreakEl = document.getElementById('stat-best-streak');
    const streakHabitEl = document.getElementById('stat-streak-habit');
    if (bestStreakEl) bestStreakEl.textContent = `${stats.overallBestStreak} ngày`;
    if (streakHabitEl) {
      streakHabitEl.textContent = stats.bestHabitName || 'Đều đặn nhất';
      streakHabitEl.setAttribute('title', stats.bestHabitName);
    }

    // 4. Tổng số hoạt động
    const totalActEl = document.getElementById('stat-total-activities');
    if (totalActEl) totalActEl.textContent = stats.totalActivities;
  }

  // --- RENDER BỘ LỌC DANH MỤC ---
  function renderCategoryFilterChips() {
    const container = document.getElementById('category-filter-container');
    if (!container) return;

    const existingCats = new Set(DEFAULT_CATEGORIES);
    state.data.activities.forEach(act => {
      if (act.category) existingCats.add(act.category);
    });

    const categories = Array.from(existingCats);
    container.innerHTML = categories.map(cat => `
      <button type="button" class="filter-chip ${cat === state.selectedCategory ? 'active' : ''}" data-cat="${cat}">
        ${cat}
      </button>
    `).join('');

    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.selectedCategory = chip.dataset.cat;
        renderMatrix();
      });
    });
  }

  // --- ĐIỀU HƯỚNG THÁNG & NĂM ---
  function updateMonthSelectUI() {
    const selectMonth = document.getElementById('select-month');
    const selectYear = document.getElementById('select-year');
    if (selectMonth) selectMonth.value = String(state.viewMonth);
    if (selectYear) selectYear.value = String(state.viewYear);
  }

  function setMonthAndYear(month, year) {
    state.viewMonth = month;
    state.viewYear = year;
    updateMonthSelectUI();
    renderMatrix();
  }

  function bindNavigationEvents() {
    // Dropdown chọn tháng
    document.getElementById('select-month')?.addEventListener('change', (e) => {
      state.viewMonth = parseInt(e.target.value, 10);
      renderMatrix();
      showToast(`Đã chuyển sang Tháng ${state.viewMonth}, ${state.viewYear}`);
    });

    // Dropdown chọn năm
    document.getElementById('select-year')?.addEventListener('change', (e) => {
      state.viewYear = parseInt(e.target.value, 10);
      renderMatrix();
      showToast(`Đã chuyển sang Năm ${state.viewYear}`);
    });

    // Nút Tháng trước
    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
      if (state.viewMonth === 1) {
        state.viewMonth = 12;
        state.viewYear -= 1;
      } else {
        state.viewMonth -= 1;
      }
      updateMonthSelectUI();
      renderMatrix();
    });

    // Nút Tháng sau
    document.getElementById('btn-next-month')?.addEventListener('click', () => {
      if (state.viewMonth === 12) {
        state.viewMonth = 1;
        state.viewYear += 1;
      } else {
        state.viewMonth += 1;
      }
      updateMonthSelectUI();
      renderMatrix();
    });

    // Nút Hôm nay
    document.getElementById('btn-today')?.addEventListener('click', () => {
      const now = new Date();
      setMonthAndYear(now.getMonth() + 1, now.getFullYear());
      setTimeout(scrollToToday, 100);
      showToast('Đã quay về tháng hiện tại');
    });

    // Toggle Theme
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
      state.theme = (state.theme === 'dark') ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem(THEME_KEY, state.theme);
      showToast(`Đã đổi giao diện sang ${state.theme === 'dark' ? 'Tối' : 'Sáng'}`);
    });

    // Toggle Âm thanh
    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem(SOUND_KEY, state.soundEnabled ? 'true' : 'false');
      updateSoundIcon(state.soundEnabled);
      showToast(state.soundEnabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh');
    });

    // Tìm kiếm
    document.getElementById('input-search')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderMatrix();
    });
  }

  function updateSoundIcon(enabled) {
    const onIcon = document.querySelector('.icon-sound-on');
    const offIcon = document.querySelector('.icon-sound-off');
    const btn = document.getElementById('btn-sound-toggle');
    if (onIcon && offIcon && btn) {
      if (enabled) {
        onIcon.style.display = 'block';
        offIcon.style.display = 'none';
        btn.classList.add('active');
      } else {
        onIcon.style.display = 'none';
        offIcon.style.display = 'block';
        btn.classList.remove('active');
      }
    }
  }

  // --- MODAL THÊM HOẠT ĐỘNG ---
  function bindModalEvents() {
    const modal = document.getElementById('activity-modal');
    const form = document.getElementById('activity-form');
    const btnOpen = document.getElementById('btn-add-activity');
    const btnClose = document.getElementById('btn-modal-close');
    const btnCancel = document.getElementById('btn-modal-cancel');
    const colorContainer = document.getElementById('color-picker-container');
    const inputColor = document.getElementById('form-activity-color');

    const openModal = () => {
      form.reset();
      document.getElementById('form-activity-id').value = '';
      selectColor('#6366f1');
      modal.classList.add('open');
      setTimeout(() => document.getElementById('form-activity-name')?.focus(), 100);
    };

    const closeModal = () => modal.classList.remove('open');

    btnOpen?.addEventListener('click', openModal);
    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    function selectColor(color) {
      if (inputColor) inputColor.value = color;
      colorContainer?.querySelectorAll('.color-swatch').forEach(swatch => {
        if (swatch.dataset.color === color) {
          swatch.classList.add('active');
        } else {
          swatch.classList.remove('active');
        }
      });
    }

    colorContainer?.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => selectColor(swatch.dataset.color));
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('form-activity-name').value;
      const category = document.getElementById('form-activity-category').value;
      const color = inputColor.value || '#6366f1';
      const desc = document.getElementById('form-activity-desc').value;

      if (!name.trim()) return;

      addActivity({ name, category, color, desc });
      closeModal();
      renderCategoryFilterChips();
      renderMatrix();
      showToast(`Đã thêm hoạt động: "${name}"`, 'success');
    });
  }

  // --- TIỆN ÍCH XUẤT NHẬP & SAO LƯU ---
  function bindUtilityEvents() {
    // Xuất JSON
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.data, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `activity_matrix_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Đã tải xuống file sao lưu JSON!');
    });

    // Nhập JSON
    const fileInput = document.getElementById('file-import-input');
    document.getElementById('btn-import-trigger')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed.activities || !Array.isArray(parsed.activities)) {
            alert('File JSON không hợp lệ!');
            return;
          }
          if (!parsed.checks) parsed.checks = {};
          if (!parsed.notes) parsed.notes = {};
          state.data = parsed;
          saveData(parsed);
          renderCategoryFilterChips();
          renderMatrix();
          showToast('Đã khôi phục dữ liệu từ JSON thành công!', 'success');
        } catch (err) {
          alert('Lỗi khi đọc file JSON: ' + err.message);
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(file);
    });

    // Xuất CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      const year = state.viewYear;
      const month = state.viewMonth;
      const daysInMonth = getDaysInMonth(year, month);
      const monthStr = String(month).padStart(2, '0');
      const isSep2026 = (year === PLAN_START_YEAR && month === PLAN_START_MONTH);
      const planStartDay = getMonthPlanStartDay(year, month);
      const targetDays = isSep2026 ? (daysInMonth - PLAN_START_DAY + 1) : daysInMonth;

      const headers = ['"Hoạt động"', '"Danh mục"'];
      for (let d = planStartDay; d <= daysInMonth; d++) {
        headers.push(`"Ngày ${d}"`);
      }
      headers.push(`"Tổng đạt (trên ${targetDays} ngày)"`, '"Tỷ lệ %"');

      const rows = [headers.join(',')];

      state.data.activities.forEach(act => {
        let completed = 0;
        const row = [`"${act.name.replace(/"/g, '""')}"`, `"${act.category || ''}"`];
        for (let d = planStartDay; d <= daysInMonth; d++) {
          const dStr = String(d).padStart(2, '0');
          const dateKey = `${year}-${monthStr}-${dStr}`;
          const isDone = state.data.checks[`${act.id}:${dateKey}`];
          const note = (state.data.notes && state.data.notes[`${act.id}:${dateKey}`]) || '';

          if (isDone) {
            completed++;
            row.push(note ? `"X (${note.replace(/"/g, '""')})"` : '"X"');
          } else {
            row.push(note ? `"(Lý do: ${note.replace(/"/g, '""')})"` : '""');
          }
        }
        const rate = Math.round((completed / targetDays) * 100);
        row.push(`"${completed}"`, `"${rate}%"`);
        rows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `activity_matrix_${year}_${monthStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Đã xuất file bảng tính CSV cho Excel!');
    });

    // Khôi phục dữ liệu mẫu
    document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
      if (confirm('Khôi phục danh sách và dữ liệu mẫu ban đầu?')) {
        state.data = getInitialSeedData();
        saveData(state.data);
        renderCategoryFilterChips();
        renderMatrix();
        showToast('Đã khôi phục dữ liệu mẫu.');
      }
    });

    // Xóa toàn bộ
    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
      if (confirm('CẢNH BÁO: Thao tác này sẽ xóa sạch tất cả hoạt động và lịch sử tick. Bạn có chắc không?')) {
        state.data = { activities: [], checks: {}, notes: {} };
        saveData(state.data);
        renderCategoryFilterChips();
        renderMatrix();
        showToast('Đã xóa toàn bộ dữ liệu.');
      }
    });
  }

  function scrollToToday() {
    const todayTh = document.querySelector('.day-header-cell.is-today');
    const scrollWrapper = document.getElementById('matrix-scroll-wrapper');
    if (todayTh && scrollWrapper) {
      const leftPos = todayTh.offsetLeft - 320;
      if (leftPos > 0) {
        scrollWrapper.scrollTo({ left: leftPos, behavior: 'smooth' });
      }
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' 
          ? '<polyline points="20 6 9 17 4 12"></polyline>' 
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
      </svg>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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

  // ==========================================================================
  // SUPABASE CLOUD SYNC LOGIC (Cho GitHub Pages & Đa Thiết Bị)
  // ==========================================================================
  const SUPABASE_CONFIG_KEY = 'habit_matrix_supabase_config';
  let supabaseClient = null;
  let cloudSyncTimeout = null;

  function getSupabaseConfig() {
    try {
      const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
      // Cấu hình mặc định từ dự án của bạn
      return {
        url: 'https://duigsircctipwrsvsgfs.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWdzaXJjY3RpcHdyc3ZzZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDEzNzYsImV4cCI6MjEwNTU3NzM3Nn0.3tIe8NATewxttQxBumpGoI2WWWOTVvGA9It4KbYL7gI'
      };
    } catch (e) {
      return null;
    }
  }

  function saveSupabaseConfig(cfg) {
    if (!cfg) {
      localStorage.removeItem(SUPABASE_CONFIG_KEY);
    } else {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cfg));
    }
  }

  function initSupabase() {
    const cfg = getSupabaseConfig();
    if (cfg && cfg.url && cfg.key && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(cfg.url, cfg.key);
        updateCloudUI(true);
        return true;
      } catch (e) {
        console.warn('Lỗi khởi tạo Supabase client:', e);
      }
    }
    updateCloudUI(false);
    return false;
  }

  function updateCloudUI(isConnected, lastSyncTime = null) {
    const dot = document.getElementById('cloud-status-dot');
    const badge = document.getElementById('cloud-status-badge');
    const lastSyncText = document.getElementById('cloud-last-sync-text');
    const statusText = document.getElementById('cloud-sync-status-text');
    const btnDisconnect = document.getElementById('btn-cloud-disconnect');
    const btnSyncNow = document.getElementById('btn-cloud-sync-now');

    if (isConnected) {
      if (dot) dot.className = 'cloud-status-dot connected';
      if (badge) {
        badge.className = 'cloud-status-badge connected';
        badge.textContent = '🟢 Đã kết nối Cloud';
      }
      if (statusText) statusText.textContent = 'Cloud OK';
      if (btnDisconnect) btnDisconnect.style.display = 'block';
      if (btnSyncNow) btnSyncNow.style.display = 'inline-flex';
      if (lastSyncText) {
        if (lastSyncTime) {
          const timeStr = new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          lastSyncText.textContent = `Đồng bộ lần cuối lúc ${timeStr}`;
        } else {
          lastSyncText.textContent = 'Đã kết nối thành công với Supabase';
        }
      }
    } else {
      if (dot) dot.className = 'cloud-status-dot';
      if (badge) {
        badge.className = 'cloud-status-badge';
        badge.textContent = '⚪ Chưa kết nối';
      }
      if (statusText) statusText.textContent = 'Cloud Sync';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      if (btnSyncNow) btnSyncNow.style.display = 'none';
      if (lastSyncText) lastSyncText.textContent = 'Dữ liệu đang lưu ở trình duyệt (LocalStorage)';
    }
  }

  function setCloudSyncStatus(status, time = null) {
    const dot = document.getElementById('cloud-status-dot');
    if (status === 'syncing') {
      if (dot) dot.className = 'cloud-status-dot syncing';
    } else if (status === 'connected') {
      updateCloudUI(true, time);
    } else {
      updateCloudUI(false);
    }
  }

  function triggerCloudSync() {
    if (!supabaseClient) return;
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    setCloudSyncStatus('syncing');
    cloudSyncTimeout = setTimeout(syncToCloud, 500);
  }

  async function syncToCloud() {
    if (!supabaseClient) return;
    try {
      setCloudSyncStatus('syncing');
      const payload = {
        id: 'default',
        data: state.data,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabaseClient
        .from('habit_data')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Lỗi khi đẩy lên Supabase:', error);
        setCloudSyncStatus('connected');
      } else {
        setCloudSyncStatus('connected', payload.updated_at);
      }
    } catch (err) {
      console.error('Lỗi syncToCloud:', err);
      setCloudSyncStatus('connected');
    }
  }

  async function syncFromCloud() {
    if (!supabaseClient) return;
    try {
      setCloudSyncStatus('syncing');
      const { data, error } = await supabaseClient
        .from('habit_data')
        .select('data, updated_at')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        console.warn('Lỗi lấy dữ liệu từ Supabase:', error);
        setCloudSyncStatus('connected');
        return;
      }

      if (data && data.data && data.data.activities) {
        state.data = data.data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
        renderCategoryFilterChips();
        renderMatrix();
        setCloudSyncStatus('connected', data.updated_at);
        showToast('Đã đồng bộ dữ liệu mới nhất từ Cloud!', 'success');
      } else {
        await syncToCloud();
      }
    } catch (err) {
      console.error('Lỗi syncFromCloud:', err);
      setCloudSyncStatus('connected');
    }
  }

  function bindCloudModalEvents() {
    const modal = document.getElementById('cloud-modal');
    const form = document.getElementById('cloud-form');
    const btnOpen = document.getElementById('btn-cloud-sync');
    const btnClose = document.getElementById('btn-cloud-modal-close');
    const btnDisconnect = document.getElementById('btn-cloud-disconnect');
    const btnSyncNow = document.getElementById('btn-cloud-sync-now');
    const inputUrl = document.getElementById('supabase-url');
    const inputKey = document.getElementById('supabase-key');

    const openModal = () => {
      const cfg = getSupabaseConfig();
      if (cfg) {
        inputUrl.value = cfg.url || '';
        inputKey.value = cfg.key || '';
      }
      updateCloudUI(!!supabaseClient);
      modal.classList.add('open');
    };

    const closeModal = () => modal.classList.remove('open');

    btnOpen?.addEventListener('click', openModal);
    btnClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = inputUrl.value.trim().replace(/\/$/, '');
      const key = inputKey.value.trim();

      if (!url || !key) return;

      if (!window.supabase) {
        alert('Không tìm thấy thư viện Supabase JS. Vui lòng kiểm tra kết nối mạng!');
        return;
      }

      const btnSubmit = document.getElementById('btn-cloud-save');
      const originalText = btnSubmit.textContent;
      btnSubmit.textContent = 'Đang kiểm tra...';
      btnSubmit.disabled = true;

      try {
        const client = window.supabase.createClient(url, key);
        const { data, error } = await client
          .from('habit_data')
          .select('id')
          .limit(1);

        if (error) {
          throw new Error(error.message + '\n\n(Lưu ý: Bạn đã chạy lệnh SQL tạo bảng habit_data trong SQL Editor chưa?)');
        }

        saveSupabaseConfig({ url, key });
        supabaseClient = client;
        updateCloudUI(true);

        await syncFromCloud();

        closeModal();
        showToast('Kết nối Supabase Cloud thành công!', 'success');
      } catch (err) {
        alert('Không thể kết nối Supabase:\n' + err.message);
      } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
      }
    });

    btnDisconnect?.addEventListener('click', () => {
      if (confirm('Ngắt kết nối Supabase? Dữ liệu vẫn được lưu an toàn trên trình duyệt này.')) {
        saveSupabaseConfig(null);
        supabaseClient = null;
        inputUrl.value = '';
        inputKey.value = '';
        updateCloudUI(false);
        closeModal();
        showToast('Đã ngắt kết nối Cloud.');
      }
    });

    btnSyncNow?.addEventListener('click', async () => {
      btnSyncNow.disabled = true;
      btnSyncNow.textContent = 'Đang đồng bộ...';
      await syncToCloud();
      btnSyncNow.textContent = 'Đồng bộ ngay';
      btnSyncNow.disabled = false;
      showToast('Đã đẩy dữ liệu mới nhất lên Cloud!', 'success');
    });
  }

  // --- KHỞI TẠO ỨNG DỤNG ---
  function init() {
    // Theme
    state.theme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);

    // Sound
    state.soundEnabled = localStorage.getItem(SOUND_KEY) !== 'false';
    updateSoundIcon(state.soundEnabled);

    // Data
    state.data = loadData();

    // UI Controls
    updateMonthSelectUI();
    renderCategoryFilterChips();
    bindNavigationEvents();
    bindModalEvents();
    bindNoteModalEvents();
    bindCloudModalEvents();
    bindUtilityEvents();

    // Render Matrix
    renderMatrix();

    // Supabase Cloud Sync Initialization
    initSupabase();
    syncFromCloud();

    // Cuộn tới ngày hôm nay
    setTimeout(scrollToToday, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
