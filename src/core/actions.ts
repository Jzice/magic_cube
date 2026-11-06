import { state } from './state';
import { buildCube, isSolved } from './cubeModel';
import { performMove } from './moveEngine';
import { moveToNotation } from './notation';
import { playMoveSound } from '../audio/audioEngine';
import { updateHistoryUI } from '../ui/historyPanel';
import { updateStatus, showToast } from '../ui/status';
import { scrambleSteps } from '../config/cubeConfig';
import { buildLogicalFromCubies } from '../solver/cubeState';
import { getSolver, solveVerified } from '../solver/solver';
import { validateLogical } from '../solver/validate';
import type { LogicalCube } from '../solver/logicalCube';
import type { Move } from '../types';

/** 还原失败时给出明确原因；魔方状态与操作历史保持原样，便于重试或重置。 */
function reportFailure(message: string): void {
  console.warn('[autoSolve]', message);
  updateStatus(`❌ ${message}`);
  showToast(`❌ ${message}`);
}

/**
 * 按本次会话的操作历史逆序回放还原（任意阶数兜底）。
 * 只做结构校验：3 阶中心块错位是中层转动产生的合法结构状态，
 * 不能用 validateFacelets 的「中心固定」条件把它拦在门外。
 * 返回是否已完整回放；失败时已给出明确原因并保持魔方与历史原样。
 */
async function replayFromHistory(logical: LogicalCube): Promise<boolean> {
  const validation = validateLogical(logical);
  if (!validation.ok) {
    reportFailure(`状态不合法：${validation.reason}`);
    return false;
  }

  const history = [...state.moveHistory];
  if (history.length === 0) {
    reportFailure(`${state.ORDER} 阶当前状态没有可回放的操作历史，无法还原，请点击「重置」`);
    return false;
  }
  const reverse: Move[] = history
    .slice()
    .reverse()
    .map((m) => ({ axis: m.axis, layerIndex: m.layerIndex, dir: (-m.dir) as 1 | -1 }));

  const probe = logical.clone();
  for (const m of reverse) probe.applyMove(m.axis, m.layerIndex, m.dir);
  if (!probe.isSolved()) {
    reportFailure('操作历史与当前魔方状态不一致，无法还原，请点击「重置」');
    return false;
  }

  updateStatus('正在按操作历史逆序还原…');
  for (const m of reverse) {
    state.notationHistory.push(moveToNotation(m.axis, m.layerIndex, m.dir));
    updateHistoryUI();
    playMoveSound();
    await performMove(m.axis, m.layerIndex, m.dir, true, 140, false, false);
  }
  return true;
}

/** 切换阶数（仅在空闲时）。 */
export function switchOrder(newOrder: number): void {
  if (state.isBusy || state.operationLocked) return;
  buildCube(newOrder);
  updateHistoryUI();
  updateStatus(`已切换到 ${newOrder} 阶魔方 · 拖动贴纸转层`);
}

/** 重置为当前阶数的还原态。 */
export function resetCube(): void {
  if (state.isBusy || state.operationLocked) return;
  buildCube(state.ORDER);
  updateHistoryUI();
  updateStatus(`已重置 ${state.ORDER} 阶魔方`);
}

/** 随机打乱。 */
export async function scramble(): Promise<void> {
  if (state.isBusy || state.operationLocked) return;
  state.operationLocked = true;
  const btn = document.getElementById('scrambleBtn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    const steps = scrambleSteps(state.ORDER);
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (let i = 0; i < steps; i++) {
      const axis = axes[Math.floor(Math.random() * 3)];
      // 3 阶每个面只有 1 个中心块，恰好落在中层（layerIndex=1），中层转动会位移中心块，
      // 产生不可能的状态；故 3 阶仅允许外层转动（0 与 order-1）。4/5 阶中心为 N-2×N-2 块、不在中层，中层转动合法。
      const layerIndex =
        state.ORDER === 3
          ? Math.random() < 0.5 ? 0 : state.ORDER - 1
          : Math.floor(Math.random() * state.ORDER);
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      await performMove(axis, layerIndex, dir, true, 110);
    }
    updateStatus(`已打乱 ${steps} 步`);
  } finally {
    state.operationLocked = false;
    if (btn) btn.disabled = false;
  }
}

/**
 * 自动还原：
 * - 2/3 阶先用真正的求解器（3 阶中心错位会先整体旋转归位再求解）；
 * - 标准求解失败或 4/5 阶无求解器时，按本次会话操作历史逆序回放兜底；
 * - 所有路径都会做状态合法性校验、解法/历史干跑验证、完成后 isSolved() 二次校验；
 * - 失败时明确报错并保留魔方与历史，绝不误报「还原完成」。
 */
export async function autoSolve(): Promise<void> {
  if (state.isBusy || state.operationLocked) return;
  const order = state.ORDER;
  const btn = document.getElementById('solveBtn') as HTMLButtonElement | null;

  if (isSolved()) {
    state.moveHistory = [];
    showToast('魔方已经是还原状态');
    return;
  }

  state.operationLocked = true;
  if (btn) btn.disabled = true;
  try {
    const logical = buildLogicalFromCubies(order, state.cubies);
    let restored = false;

    if (getSolver(order)) {
      const result = solveVerified(logical);
      if (result.ok) {
        updateStatus('正在自动求解…');
        for (const m of result.solution) {
          await performMove(m.axis, m.layerIndex, m.dir, true, 160, false, true);
          state.notationHistory.push(moveToNotation(m.axis, m.layerIndex, m.dir));
          updateHistoryUI();
        }
        restored = true;
      } else {
        // 先不弹失败提示：中心错位等状态仍可能通过操作历史逆序回放还原。
        console.warn('[autoSolve] 标准求解失败，尝试按操作历史逆序还原：', result.reason);
      }
    }

    if (!restored) restored = await replayFromHistory(logical);
    if (!restored) return;

    // 解后二次校验：任何一条路径都必须真正还原，否则明确报错且保留历史。
    if (!isSolved()) {
      reportFailure('还原失败：完成后校验未通过，魔方状态与操作历史已保留');
      return;
    }
    state.moveHistory = [];
    updateStatus('✅ 自动还原完成');
  } finally {
    state.operationLocked = false;
    if (btn) btn.disabled = false;
  }
}

/** 供 UI 查询：当前是否已还原。 */
export function currentIsSolved(): boolean {
  return isSolved();
}
