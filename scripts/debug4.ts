import rubiksCubeSolver, { RubiksCube } from 'rubiks-cube-solver';
import { LogicalCube } from '../src/solver/logicalCube';
import { buildStateString } from '../src/solver/layerSolver3';
import type { Axis } from '../src/types';

// A) 库自己的打乱态
let libOwnFail = 0;
for (let i = 0; i < 30; i++) {
  const rc = RubiksCube.Scrambled();
  const st = rc.toString();
  try {
    const sol = rubiksCubeSolver(st) as string;
    if (!sol || sol.trim().length === 0) { libOwnFail++; console.log('  lib-own empty', i); }
  } catch (e) {
    libOwnFail++;
    console.log('  lib-own THROW', i, (e as Error).message);
  }
}
console.log('A) 库自己打乱态: 失败', libOwnFail, '/ 30');

// B) 我们的打乱态（经由 LogicalCube.applyMove）
const axes: Axis[] = ['x', 'y', 'z'];
let oursFail = 0;
for (let i = 0; i < 30; i++) {
  const cube = LogicalCube.solved(3);
  for (let k = 0; k < 25; k++) {
    const axis = axes[Math.floor(Math.random() * 3)];
    const layerIndex = Math.floor(Math.random() * 3);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    cube.applyMove(axis, layerIndex, dir);
  }
  const st = buildStateString(cube);
  try {
    const sol = rubiksCubeSolver(st) as string;
    if (!sol || sol.trim().length === 0) { oursFail++; console.log('  ours empty', i); }
  } catch (e) {
    oursFail++;
    if (oursFail <= 2) console.log('  ours THROW', i, (e as Error).message, 'state', st);
  }
}
console.log('B) 我们的打乱态: 失败', oursFail, '/ 30');
