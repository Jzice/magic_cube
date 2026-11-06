import './style.css';
import { initScene } from './core/scene';
import { buildCube } from './core/cubeModel';
import { startLoop } from './core/moveEngine';
import { onPointerDown, onPointerMove, onPointerUp } from './interaction/pointerControls';
import { initUI } from './ui/bootstrap';
import { bindControls } from './ui/controls';
import { buildTutorialSteps } from './ui/tutorialPanel';
import { updateHistoryUI } from './ui/historyPanel';
import { updateStatus } from './ui/status';
import { state } from './core/state';
import { warmupSolver3 } from './solver/layerSolver3';

function main(): void {
  initUI();
  initScene();
  buildCube(state.ORDER);
  updateHistoryUI();

  bindControls();

  const canvas = state.renderer!.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  buildTutorialSteps();
  startLoop();

  updateStatus('拖动贴纸转层 · 拖拽空白处旋转视角 · 滚轮缩放');

  // 空闲时预热 3 阶求解器剪枝表，避免首次点击「自动还原」时同步初始化卡顿。
  const warmup = (): void => warmupSolver3();
  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (idle) idle.call(window, warmup, { timeout: 5000 });
  else window.setTimeout(warmup, 800);
}

main();
