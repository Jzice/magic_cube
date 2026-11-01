import { ORDER_OPTIONS } from '../config/cubeConfig';
import { state } from '../core/state';

/**
 * 注入 UI 外壳（顶部控制栏、底部状态、操作记录、教学面板、Toast）。
 * 重构后这些 DOM 不再内联在 index.html，统一在此创建，其余 UI 模块按 id 绑定。
 */
export function initUI(): void {
  const orderOptions = ORDER_OPTIONS.map(
    (o) => `<option value="${o}"${o === state.ORDER ? ' selected' : ''}>${o} 阶</option>`,
  ).join('');

  const html = `
    <div id="topbar">
      <div class="pill">
        <label>阶数</label>
        <select id="orderSelect">${orderOptions}</select>
      </div>
      <button id="scrambleBtn">🎲 随机打乱</button>
      <button id="solveBtn" class="primary">✨ 自动还原</button>
      <button id="resetBtn">↺ 重置</button>
      <button id="tutorialBtn">📖 教学</button>
      <button id="muteBtn" title="音效开关">${state.isMuted ? '🔇' : '🔊'}</button>
    </div>

    <div id="bottombar">
      <div id="status"></div>
    </div>

    <div id="history-panel">
      <div class="title"><span>操作记录</span><span id="historyCount">0</span></div>
      <div id="history-list"></div>
    </div>

    <div id="tutorial">
      <h3>七步层先法 <button id="closeTutorial" class="close-btn" title="关闭">✕</button></h3>
      <div id="tutorialContent"></div>
    </div>

    <div id="toast"></div>
  `;

  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild as Node);
}
