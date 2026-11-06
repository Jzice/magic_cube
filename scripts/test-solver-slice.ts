import { LogicalCube } from '../src/solver/logicalCube';
import { centersSolved, normalizeCenters } from '../src/solver/centerFrame';
import { solveVerified } from '../src/solver/solver';
import { buildStateString } from '../src/solver/layerSolver3';
import { validateFacelets, validateLogical } from '../src/solver/validate';
import type { Axis, Move } from '../src/types';

/**
 * 冒烟测试：3 阶中层（M/E/S）混合动作产生中心块错位后，
 * 「中心归位 + 标准求解」与「操作历史逆序回放」两条路径都能真正还原；
 * 同时确认纯外层打乱 / 2 阶 / 4 阶的原有行为不变。
 * 运行：npx tsx scripts/test-solver-slice.ts
 */

// 固定种子，失败可复现
let seed = 20261106;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

const axes: Axis[] = ['x', 'y', 'z'];

function randomMove(order: number, allowSlice: boolean): Move {
  const axis = axes[Math.floor(rnd() * 3)];
  const layerIndex = allowSlice
    ? Math.floor(rnd() * order)
    : (rnd() < 0.5 ? 0 : order - 1);
  const dir: 1 | -1 = rnd() < 0.5 ? 1 : -1;
  return { axis, layerIndex, dir };
}

function scramble(cube: LogicalCube, steps: number, allowSlice: boolean): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < steps; i++) {
    const m = randomMove(cube.order, allowSlice);
    cube.applyMove(m.axis, m.layerIndex, m.dir);
    moves.push(m);
  }
  return moves;
}

function applyAll(cube: LogicalCube, moves: Move[]): void {
  for (const m of moves) cube.applyMove(m.axis, m.layerIndex, m.dir);
}

function reverseMoves(moves: Move[]): Move[] {
  return moves.slice().reverse().map((m) => ({ ...m, dir: (-m.dir) as 1 | -1 }));
}

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) pass++;
  else {
    fail++;
    console.log('FAIL:', name, detail);
  }
}

// ===== 单个中层动作：必然造成中心块错位，且必须可解 =====
{
  const cube = LogicalCube.solved(3);
  cube.applyMove('y', 1, 1);
  check('single-slice/中心错位', !centersSolved(cube));
  check('single-slice/结构合法', validateLogical(cube).ok);
  const frame = normalizeCenters(cube);
  check('single-slice/可归位', !!frame && frame.prefix.length > 0 && centersSolved(frame.cube));
  const result = solveVerified(cube);
  check('single-slice/可求解', result.ok, result.ok ? '' : result.reason);
  if (result.ok) {
    const probe = cube.clone();
    applyAll(probe, result.solution);
    check('single-slice/干跑还原', probe.isSolved());
  }
}

// ===== 纯外层打乱：与改动前一致，仍走标准求解路径 =====
for (let t = 0; t < 16; t++) {
  const cube = LogicalCube.solved(3);
  scramble(cube, 20, false);
  if (cube.isSolved()) continue;
  check(`outer#${t}/中心固定`, centersSolved(cube));
  check(`outer#${t}/标准状态合法`, validateFacelets(buildStateString(cube)).ok);
  const frame = normalizeCenters(cube);
  check(`outer#${t}/无需归位`, !!frame && frame.prefix.length === 0);
  const result = solveVerified(cube);
  check(`outer#${t}/可求解`, result.ok, result.ok ? '' : result.reason);
  if (result.ok) {
    check(`outer#${t}/解法仅外层`, result.solution.every((m) => m.layerIndex === 0 || m.layerIndex === 2));
    const probe = cube.clone();
    applyAll(probe, result.solution);
    check(`outer#${t}/干跑还原`, probe.isSolved());
  }
}

// ===== 外层 + 中层混合打乱：两条路径都要能还原 =====
for (let t = 0; t < 16; t++) {
  const cube = LogicalCube.solved(3);
  const moves = scramble(cube, 20, true);
  if (cube.isSolved()) continue;
  check(`mixed#${t}/结构合法`, validateLogical(cube).ok);
  const frame = normalizeCenters(cube);
  check(`mixed#${t}/可归位`, !!frame && centersSolved(frame.cube));

  const result = solveVerified(cube);
  check(`mixed#${t}/可求解`, result.ok, result.ok ? '' : result.reason);
  if (result.ok) {
    const probe = cube.clone();
    applyAll(probe, result.solution);
    check(`mixed#${t}/干跑还原`, probe.isSolved());
  }

  const replay = cube.clone();
  applyAll(replay, reverseMoves(moves));
  check(`mixed#${t}/历史逆序还原`, replay.isSolved());
}

// ===== 2 阶不受中心归位影响；4 阶仍明确返回无求解器 =====
for (let t = 0; t < 8; t++) {
  const cube = LogicalCube.solved(2);
  scramble(cube, 12, false);
  if (cube.isSolved()) continue;
  const result = solveVerified(cube);
  check(`2x2#${t}/可求解`, result.ok, result.ok ? '' : result.reason);
  if (result.ok) {
    const probe = cube.clone();
    applyAll(probe, result.solution);
    check(`2x2#${t}/干跑还原`, probe.isSolved());
  }
}
{
  const cube = LogicalCube.solved(4);
  scramble(cube, 5, false);
  const result = solveVerified(cube);
  check('4x4/仍提示无求解器', !result.ok && result.reason.includes('暂无求解器'), result.ok ? 'unexpected ok' : result.reason);
}

console.log(`中心归位与中层还原冒烟测试: pass=${pass} fail=${fail}`);
if (fail > 0) process.exit(1);
