import { state } from './state';
import { buildCube, isSolved } from './cubeModel';
import { performMove } from './moveEngine';
import { moveToNotation } from './notation';
import { playMoveSound } from '../audio/audioEngine';
import { updateHistoryUI } from '../ui/historyPanel';
import { updateStatus, showToast } from '../ui/status';
import { scrambleSteps } from '../config/cubeConfig';
import { buildLogicalFromCubies } from '../solver/cubeState';
import { getSolver } from '../solver/solver';

/** 切换阶数（仅在空闲时）。 */
export function switchOrder(newOrder: number): void {
  if (state.isBusy) return;
  buildCube(newOrder);
  updateHistoryUI();
  updateStatus(`已切换到 ${newOrder} 阶魔方 · 拖动贴纸转层`);
}

/** 重置为当前阶数的还原态。 */
export function resetCube(): void {
  if (state.isBusy) return;
  buildCube(state.ORDER);
  updateHistoryUI();
  updateStatus(`已重置 ${state.ORDER} 阶魔方`);
}

/** 随机打乱。 */
export async function scramble(): Promise<void> {
  if (state.isBusy) return;
  const btn = document.getElementById('scrambleBtn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  const steps = scrambleSteps(state.ORDER);
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (let i = 0; i < steps; i++) {
    const axis = axes[Math.floor(Math.random() * 3)];
    const layerIndex = Math.floor(Math.random() * state.ORDER);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    await performMove(axis, layerIndex, dir, true, 110);
  }

  if (btn) btn.disabled = false;
  updateStatus(`已打乱 ${steps} 步`);
}

/**
 * 自动还原：
 * - 2/3 阶使用真正的层先法求解器（任意打乱状态均可还原）。
 * - 4/5 阶暂使用逆序回放历史作为兜底（见 README / CHANGELOG 说明）。
 */
export async function autoSolve(): Promise<void> {
  if (state.isBusy) return;
  const order = state.ORDER;
  const btn = document.getElementById('solveBtn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  const solver = getSolver(order);
  if (solver) {
    const logical = buildLogicalFromCubies(order, state.cubies);
    if (logical.isSolved()) {
      showToast('魔方已经是还原状态');
      if (btn) btn.disabled = false;
      return;
    }

    const solution = solver.solve(logical);
    updateStatus('正在自动求解…');

    for (const m of solution) {
      await performMove(m.axis, m.layerIndex, m.dir, true, 160, false, true);
      state.notationHistory.push(moveToNotation(m.axis, m.layerIndex, m.dir));
      updateHistoryUI();
    }
    if (btn) btn.disabled = false;
    updateStatus('✅ 自动还原完成');
    return;
  }

  // 4/5 阶兜底：逆序回放历史
  if (state.moveHistory.length === 0) {
    showToast('魔方已经是还原状态');
    if (btn) btn.disabled = false;
    return;
  }
  const history = [...state.moveHistory];
  state.moveHistory = [];
  updateStatus('正在逆序回放还原…');
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const rev = (-m.dir) as 1 | -1;
    state.notationHistory.push(moveToNotation(m.axis, m.layerIndex, rev));
    updateHistoryUI();
    playMoveSound();
    await performMove(m.axis, m.layerIndex, rev, true, 140, false, false);
  }
  if (btn) btn.disabled = false;
  updateStatus('✅ 自动还原完成');
}

/** 供 UI 查询：当前是否已还原。 */
export function currentIsSolved(): boolean {
  return isSolved();
}
