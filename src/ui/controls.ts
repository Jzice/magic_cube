import { state } from '../core/state';
import { switchOrder, scramble, autoSolve, resetCube } from '../core/actions';
import { toggleTutorial } from './tutorialPanel';
import { initAudio } from '../audio/audioEngine';

/** 绑定顶部控制栏的所有按钮与下拉框。 */
export function bindControls(): void {
  const orderSelect = document.getElementById('orderSelect') as HTMLSelectElement | null;
  orderSelect?.addEventListener('change', (e) => switchOrder(parseInt((e.target as HTMLSelectElement).value, 10)));

  document.getElementById('scrambleBtn')?.addEventListener('click', () => void scramble());
  document.getElementById('solveBtn')?.addEventListener('click', () => void autoSolve());
  document.getElementById('resetBtn')?.addEventListener('click', () => resetCube());
  document.getElementById('tutorialBtn')?.addEventListener('click', toggleTutorial);
  document.getElementById('closeTutorial')?.addEventListener('click', toggleTutorial);

  const muteBtn = document.getElementById('muteBtn');
  muteBtn?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    muteBtn.textContent = state.isMuted ? '🔇' : '🔊';
    if (!state.isMuted) initAudio();
  });

  // 首次交互初始化音频上下文（浏览器自动播放策略）
  document.body.addEventListener('pointerdown', initAudio, { once: true });
}
