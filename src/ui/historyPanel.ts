import { state } from '../core/state';

/** 刷新操作记录面板（最近 30 步）。 */
export function updateHistoryUI(): void {
  const list = document.getElementById('history-list');
  const countEl = document.getElementById('historyCount');
  if (!list || !countEl) return;

  list.innerHTML = '';
  countEl.textContent = String(state.notationHistory.length);

  const displayHistory = state.notationHistory.slice(-30);
  for (const item of displayHistory) {
    const span = document.createElement('span');
    span.className = 'history-item';
    span.textContent = item;
    list.appendChild(span);
  }
  list.scrollTop = list.scrollHeight;
}
