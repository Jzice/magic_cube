import { LogicalCube } from '../src/solver/logicalCube';
import { buildStateString } from '../src/solver/layerSolver3';
import kociemba from 'kociemba';
import type { Axis } from '../src/types';

const axes: Axis[] = ['x', 'y', 'z'];
function rand(cube: LogicalCube, n: number, allowMiddle: boolean) {
  for (let i = 0; i < n; i++) {
    const axis = axes[Math.floor(Math.random() * 3)];
    const layerIndex = allowMiddle ? Math.floor(Math.random() * 3) : (Math.random() < 0.5 ? 0 : 2);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    cube.applyMove(axis, layerIndex, dir);
  }
}

for (const [label, n, mid] of [['1move', 1, true], ['2move', 2, true], ['3move', 3, true], ['5move', 5, true], ['10move', 10, true], ['25move', 25, true], ['25noMid', 25, false]] as const) {
  let fail = 0;
  for (let t = 0; t < 30; t++) {
    const cube = LogicalCube.solved(3);
    rand(cube, n, mid);
    if (cube.isSolved()) { t--; continue; }
    const st = buildStateString(cube);
    try { kociemba.solve(st); } catch { fail++; }
  }
  console.log(`${label}: fail ${fail}/30`);
}
