import type { Solver, Move } from '../types';
import type { LogicalCube } from './logicalCube';
import { LayerSolver3 } from './layerSolver3';
import { LayerSolver2 } from './layerSolver2';

const solvers: Solver[] = [
  new LayerSolver2(),
  new LayerSolver3(),
];

/** 返回支持该阶数的求解器；不支持时返回 null（调用方退化为逆序回放）。 */
export function getSolver(order: number): Solver | null {
  const found = solvers.find((s) => s.supportedOrders.includes(order));
  return found ?? null;
}

/** 供测试：对给定逻辑魔方求解，返回动作序列。 */
export function solveLogical(cube: LogicalCube): Move[] | null {
  const solver = getSolver(cube.order);
  return solver ? solver.solve(cube) : null;
}
