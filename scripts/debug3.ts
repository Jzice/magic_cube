import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver3 } from '../src/solver/layerSolver3';
import { buildStateString } from '../src/solver/layerSolver3';
import type { Axis } from '../src/types';

const axes: Axis[] = ['x', 'y', 'z'];

function randScramble(cube: LogicalCube, n: number): string[] {
  const moves: string[] = [];
  for (let i = 0; i < n; i++) {
    const axis = axes[Math.floor(Math.random() * 3)];
    const layerIndex = Math.floor(Math.random() * cube.order);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    cube.applyMove(axis, layerIndex, dir);
    moves.push(`${axis}${layerIndex}${dir > 0 ? '+' : '-'}`);
  }
  return moves;
}

function validateString(s: string): void {
  const counts: Record<string, number> = {};
  for (const ch of s) counts[ch] = (counts[ch] ?? 0) + 1;
  console.log('  颜色计数:', JSON.stringify(counts));
  const bad = Object.entries(counts).filter(([, v]) => v !== 9);
  if (bad.length) console.log('  !! 存在非 9 的颜色:', bad);
}

// 1) 已还原态应可直接求解（空解或平凡解）
const solved = LogicalCube.solved(3);
console.log('solved state len:', buildStateString(solved).length);
try {
  const sol = new LayerSolver3().solve(solved);
  console.log('solved -> moves:', sol.length);
} catch (e) {
  console.log('solved -> THROW:', (e as Error).message);
}

// 2) 单次打乱应可解
const c1 = LogicalCube.solved(3);
c1.applyMove('x', 2, 1);
const s1 = buildStateString(c1);
console.log('one-move state:', s1);
validateString(s1);
try {
  const sol = new LayerSolver3().solve(c1);
  console.log('one-move -> moves:', sol.length);
  sol.forEach((m) => c1.applyMove(m.axis, m.layerIndex, m.dir));
  console.log('one-move solved?', c1.isSolved());
} catch (e) {
  console.log('one-move -> THROW:', (e as Error).message);
}

// 3) 抓取一个失败案例
console.log('--- 随机抓取失败案例 ---');
for (let t = 0; t < 500; t++) {
  const cube = LogicalCube.solved(3);
  const scr = randScramble(cube, 25);
  if (cube.isSolved()) continue;
  const st = buildStateString(cube);
  try {
    const sol = new LayerSolver3().solve(cube);
    let ok = true;
    for (const m of sol) {
      cube.applyMove(m.axis, m.layerIndex, m.dir);
      if (!cube.isSolved() && sol.indexOf(m) === sol.length - 1) ok = cube.isSolved();
    }
    if (!cube.isSolved()) {
      console.log('FAIL case t=', t, 'scramble=', scr.join(' '));
      console.log('  state:', st);
      validateString(st);
      break;
    }
  } catch (e) {
    console.log('THROW case t=', t, 'scramble=', scr.join(' '));
    console.log('  state:', st);
    validateString(st);
    console.log('  err:', (e as Error).message);
    break;
  }
}
console.log('done');
