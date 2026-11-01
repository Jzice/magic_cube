import type { Axis, Move } from '../types';
import { state } from './state';
import { performMove } from './moveEngine';

/**
 * 由 (轴, 层序号, 方向) 生成标准记号串。
 * 外层用 R/L/U/D/F/B；4/5 阶内层用 2L/2R 等前缀（与原版一致）。
 */
export function moveToNotation(axis: Axis, layerIndex: number, dir: 1 | -1): string {
  const N = state.ORDER;
  let face: string;
  if (axis === 'x') {
    if (layerIndex === N - 1) face = 'R';
    else if (layerIndex === 0) face = 'L';
    else face = 'M';
  } else if (axis === 'y') {
    if (layerIndex === N - 1) face = 'U';
    else if (layerIndex === 0) face = 'D';
    else face = 'E';
  } else {
    if (layerIndex === N - 1) face = 'F';
    else if (layerIndex === 0) face = 'B';
    else face = 'S';
  }

  let prefix = '';
  if (layerIndex !== 0 && layerIndex !== N - 1) {
    if (axis === 'x') {
      prefix = layerIndex < N / 2 ? `${layerIndex + 1}L` : `${N - layerIndex}R`;
      face = '';
    } else if (axis === 'y') {
      prefix = layerIndex < N / 2 ? `${layerIndex + 1}D` : `${N - layerIndex}U`;
      face = '';
    } else {
      prefix = layerIndex < N / 2 ? `${layerIndex + 1}B` : `${N - layerIndex}F`;
      face = '';
    }
  }

  let finalStr = prefix || face;

  let baseDir = -1;
  if (finalStr.endsWith('L') || finalStr.endsWith('D') || finalStr.endsWith('B')) baseDir = 1;

  if (dir !== baseDir) finalStr += "'";
  return finalStr;
}

/** 解析标准记号串为 (轴, 层序号, 方向) 序列。 */
export function parseFormula(formula: string): Move[] {
  const regex = /([RLUDFB])(['2]?)/g;
  const moves: Move[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(formula)) !== null) {
    const face = match[1];
    const modifier = match[2];
    let axis: Axis;
    let layerIndex: number;
    let baseDir: 1 | -1;
    switch (face) {
      case 'R': axis = 'x'; layerIndex = state.ORDER - 1; baseDir = -1; break;
      case 'L': axis = 'x'; layerIndex = 0; baseDir = 1; break;
      case 'U': axis = 'y'; layerIndex = state.ORDER - 1; baseDir = -1; break;
      case 'D': axis = 'y'; layerIndex = 0; baseDir = 1; break;
      case 'F': axis = 'z'; layerIndex = state.ORDER - 1; baseDir = -1; break;
      case 'B': axis = 'z'; layerIndex = 0; baseDir = 1; break;
      default: continue;
    }

    if (modifier === "'") moves.push({ axis, layerIndex, dir: (-baseDir) as 1 | -1 });
    else if (modifier === '2') {
      moves.push({ axis, layerIndex, dir: baseDir });
      moves.push({ axis, layerIndex, dir: baseDir });
    } else moves.push({ axis, layerIndex, dir: baseDir });
  }
  return moves;
}

/** 执行一串记号（教学单步 / 一键演示用）。 */
export async function executeFormula(formula: string, singleStepOnly = false): Promise<void> {
  if (state.isBusy) return;
  const moves = parseFormula(formula);
  if (moves.length === 0) return;

  const tutorialBtn = document.getElementById('tutorialBtn') as HTMLButtonElement | null;
  if (tutorialBtn) tutorialBtn.disabled = true;

  for (let i = 0; i < moves.length; i++) {
    if (singleStepOnly && i > 0) break;
    const m = moves[i];
    await performMove(m.axis, m.layerIndex, m.dir, true, 320);
  }

  if (tutorialBtn) tutorialBtn.disabled = false;
}
