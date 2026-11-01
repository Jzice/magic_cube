import './style.css';
import { initScene } from './core/scene';
import { buildCube } from './core/cubeModel';
import { startLoop } from './core/moveEngine';
import { onPointerDown, onPointerMove, onPointerUp } from './interaction/pointerControls';
import { bindControls } from './ui/controls';
import { buildTutorialSteps } from './ui/tutorialPanel';
import { updateHistoryUI } from './ui/historyPanel';
import { updateStatus } from './ui/status';
import { state } from './core/state';

function main(): void {
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
}

main();
