import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver3 } from '../src/solver/layerSolver3';
import type { Axis } from '../src/types';

const axes: Axis[] = ['x', 'y', 'z'];

/** 3 阶只用外层转动（与真实打乱一致：中层会位移中心块）。 */
function scramble(cube: LogicalCube, n: number): void {
  for (let i = 0; i < n; i++) {
    const axis = axes[Math.floor(Math.random() * 3)];
    const layerIndex = Math.random() < 0.5 ? 0 : 2;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    cube.applyMove(axis, layerIndex, dir);
  }
}

const solver = new LayerSolver3();
let pass = 0;
let fail = 0;
const fails: string[] = [];

for (let t = 0; t < 300; t++) {
  const cube = LogicalCube.solved(3);
  scramble(cube, 25);
  if (cube.isSolved()) { t--; continue; }
  const moves = solver.solve(cube) ?? [];
  for (const m of moves) cube.applyMove(m.axis, m.layerIndex, m.dir);
  const ok = cube.isSolved();
  if (ok) pass++;
  else {
    fail++;
    if (fails.length < 3) fails.push(`t=${t} moves=${moves.length} solved=${ok}`);
  }
}

console.log(`3阶(kociemba,外层打乱): pass=${pass} fail=${fail}`);
for (const f of fails) console.log('FAIL:', f);
if (fail > 0) process.exit(1);
