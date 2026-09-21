/**
 * Tracker Module: Xử lý nghiệp vụ thói quen, tính toán thống kê, tỷ lệ hoàn thành, streaks & âm thanh
 */

import { saveData } from './storage.js';

// Khởi tạo AudioContext cho âm thanh bấm tick mượt mà (không cần file mp3 ngoài)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Phát âm thanh vui tai khi click checkbox
 */
export function playCheckSound(isChecked) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (isChecked) {
      // Âm thanh 'pop-ding' trong trẻo khi hoàn thành
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08); // G5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      // Âm thanh 'tick' nhẹ khi hủy chọn
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (e) {
    // Không làm gián đoạn UI nếu trình duyệt chặn autoplay audio
  }
}

/**
 * Thêm hoạt động mới
 */
export function addActivity(state, { name, category, color, desc }) {
  const newActivity = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name.trim(),
    category: category || 'Sức khỏe',
    color: color || '#6366f1',
    desc: desc ? desc.trim() : '',
    createdAt: new Date().toISOString()
  };

  state.activities.push(newActivity);
  saveData(state);
  return newActivity;
}

/**
 * Sửa thông tin hoạt động (đổi tên, màu, danh mục)
 */
export function updateActivity(state, activityId, updates) {
  const activity = state.activities.find(a => a.id === activityId);
  if (!activity) return null;

  Object.assign(activity, updates);
  saveData(state);
  return activity;
}

/**
 * Xóa hoạt động và dọn dẹp các record liên quan
 */
export function deleteActivity(state, activityId) {
  state.activities = state.activities.filter(a => a.id !== activityId);
  
  // Xóa các check thuộc activity này
  Object.keys(state.checks).forEach(key => {
    if (key.startsWith(activityId + ':')) {
      delete state.checks[key];
    }
  });

  saveData(state);
}

/**
 * Đổi trạng thái checkbox của hoạt động vào ngày cụ thể
 * dateStr có định dạng YYYY-MM-DD
 */
export function toggleActivityCheck(state, activityId, dateStr) {
  const key = `${activityId}:${dateStr}`;
  const nextState = !state.checks[key];

  if (nextState) {
    state.checks[key] = true;
  } else {
    delete state.checks[key];
  }

  saveData(state);
  return nextState;
}

/**
 * Tính toán toàn bộ thống kê cho tháng đang hiển thị
 */
export function calculateMonthStats(state, year, month, daysInMonth) {
  const monthStr = String(month).padStart(2, '0');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayDate = now.getDate();

  const isCurrentViewingMonth = (year === currentYear && month === currentMonth);
  const totalActivities = state.activities.length;

  // Thống kê từng ngày trong tháng
  const dailyStats = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dStr}`;
    let completed = 0;

    state.activities.forEach(act => {
      if (state.checks[`${act.id}:${dateKey}`]) {
        completed++;
      }
    });

    const rate = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;
    dailyStats[d] = {
      completed,
      total: totalActivities,
      rate
    };
  }

  // Thống kê từng hoạt động theo hàng (row stats)
  const activityStats = {};
  let overallBestStreak = 0;
  let bestHabitName = 'Chưa có';

  state.activities.forEach(act => {
    let completedDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Giới hạn tính streak tới ngày hôm nay nếu xem tháng hiện tại, hoặc cả tháng nếu tháng quá khứ
    const endDayForStreak = isCurrentViewingMonth ? todayDate : daysInMonth;

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dStr}`;
      const isDone = !!state.checks[`${act.id}:${dateKey}`];

      if (isDone) {
        completedDays++;
        if (d <= endDayForStreak) {
          tempStreak++;
          if (tempStreak > maxStreak) maxStreak = tempStreak;
        }
      } else {
        if (d <= endDayForStreak) {
          tempStreak = 0;
        }
      }
    }

    currentStreak = tempStreak;
    const rate = Math.round((completedDays / daysInMonth) * 100);

    activityStats[act.id] = {
      completedDays,
      rate,
      maxStreak,
      currentStreak
    };

    if (maxStreak > overallBestStreak) {
      overallBestStreak = maxStreak;
      bestHabitName = act.name;
    }
  });

  // Thống kê hôm nay
  let todayRate = 0;
  let todayCount = 0;
  if (isCurrentViewingMonth && dailyStats[todayDate]) {
    todayCount = dailyStats[todayDate].completed;
    todayRate = dailyStats[todayDate].rate;
  }

  // Thống kê cả tháng
  let monthTotalChecks = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    monthTotalChecks += dailyStats[d].completed;
  }
  const monthMaxPossible = totalActivities * daysInMonth;
  const monthRate = monthMaxPossible > 0 ? Math.round((monthTotalChecks / monthMaxPossible) * 100) : 0;

  return {
    todayRate,
    todayCount,
    totalActivities,
    monthRate,
    monthTotalChecks,
    overallBestStreak,
    bestHabitName,
    dailyStats,
    activityStats
  };
}
