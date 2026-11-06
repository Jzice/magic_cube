import { LogicalCube } from '../src/solver/logicalCube';
import { buildStateString } from '../src/solver/layerSolver3';
import kociemba from 'kociemba';
import type { Axis } from '../src/types';

const axes: Axis[] = ['x', 'y', 'z'];

function rand(cube: LogicalCube, n: number) {
  for (let i = 0; i < n; i++) {
    const axis = axes[Math.floor(Math.random() * 3)];
    const layerIndex = Math.floor(Math.random() * 3);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    cube.applyMove(axis, layerIndex, dir);
  }
}

for (let t = 0; t < 200; t++) {
  const cube = LogicalCube.solved(3);
  rand(cube, 25);
  if (cube.isSolved()) continue;
  const st = buildStateString(cube);
  const counts: Record<string, number> = {};
  for (const ch of st) counts[ch] = (counts[ch] ?? 0) + 1;
  if (Object.values(counts).some((v) => v !== 9)) {
    console.log('BAD COUNTS at t=', t, counts, st);
    break;
  }
  try {
    kociemba.solve(st);
  } catch (e) {
    console.log('UNSOLVABLE t=', t, 'state=', st);
    const c2: Record<string, number> = {};
    for (const ch of st) c2[ch] = (c2[ch] ?? 0) + 1;
    console.log('counts', c2);
    break;
  }
}
console.log('done scanning');
