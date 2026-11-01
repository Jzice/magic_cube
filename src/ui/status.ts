/** 更新底部状态栏文本。 */
export function updateStatus(text: string): void {
  const el = document.getElementById('status');
  if (el) el.innerHTML = text;
}

let toastTimer: number | undefined;
/** 居中 Toast 提示。 */
export function showToast(text: string): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
}
