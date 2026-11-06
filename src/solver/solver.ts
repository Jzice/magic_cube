import type { Solver, Move } from '../types';
import type { LogicalCube } from './logicalCube';
import { LayerSolver3, buildStateString } from './layerSolver3';
import { LayerSolver2 } from './layerSolver2';
import { validateFacelets, validateLogical, type Validation } from './validate';
import { normalizeCenters } from './centerFrame';

const solvers: Solver[] = [
  new LayerSolver2(),
  new LayerSolver3(),
];

/** 返回支持该阶数的求解器；不支持时返回 null（调用方退化为逆序回放）。 */
export function getSolver(order: number): Solver | null {
  const found = solvers.find((s) => s.supportedOrders.includes(order));
  return found ?? null;
}

/** 完整校验当前逻辑状态：通用结构 + 3 阶标准可解性条件。 */
export function validateCube(cube: LogicalCube): Validation {
  const structural = validateLogical(cube);
  if (!structural.ok) return structural;
  return cube.order === 3 ? validateFacelets(buildStateString(cube)) : { ok: true };
}

export type SolveResult =
  | { ok: true; solution: Move[] }
  | { ok: false; reason: string };

/**
 * 求解并先在逻辑魔方上「干跑」验证解法，确认无误才交给 3D 引擎回放。
 * 3 阶中心块错位（拖拽中层造成）时，先用整体旋转把中心归位，再对归位后的标准状态求解；
 * 归位动作为解法前缀，干跑从原始状态出发验证完整序列。
 * 任何非法状态 / 无解 / 求解器异常都返回明确原因，不会出现空解被当成成功。
 */
export function solveVerified(cube: LogicalCube): SolveResult {
  const structural = validateLogical(cube);
  if (!structural.ok) return { ok: false, reason: structural.reason };

  const frame = normalizeCenters(cube);
  if (!frame) {
    return { ok: false, reason: '3 阶中心块错位且无法通过整体旋转归位（状态不合法）' };
  }

  const validation = validateCube(frame.cube);
  if (!validation.ok) return { ok: false, reason: validation.reason };

  const solver = getSolver(cube.order);
  if (!solver) return { ok: false, reason: `${cube.order} 阶暂无求解器` };

  let moves: Move[] | null;
  try {
    moves = solver.solve(frame.cube);
  } catch (err) {
    console.warn('[solver] 求解异常', err);
    return { ok: false, reason: '求解器异常，未能生成解法' };
  }
  if (!moves || moves.length === 0) {
    return { ok: false, reason: '求解器未找到解（状态可能不合法）' };
  }

  const solution = [...frame.prefix, ...moves];
  // 必须从原始状态出发，连同归位前缀一起干跑；整体旋转方向若有误会被这里拦截。
  const probe = cube.clone();
  for (const m of solution) probe.applyMove(m.axis, m.layerIndex, m.dir);
  if (!probe.isSolved()) {
    return { ok: false, reason: '解法校验未通过（状态不合法或求解失败）' };
  }
  return { ok: true, solution };
}

/** 供测试：对给定逻辑魔方求解，返回动作序列；无解时返回 null。 */
export function solveLogical(cube: LogicalCube): Move[] | null {
  const result = solveVerified(cube);
  return result.ok ? result.solution : null;
}
