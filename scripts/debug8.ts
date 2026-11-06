import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver3 } from '../src/solver/layerSolver3';
import { buildStateString } from '../src/solver/layerSolver3';
import kociemba from 'kociemba';
import type { Axis } from '../src/types';

const solver = new LayerSolver3();

// 逐面单步 +1 转动，求解，应用解法，校验是否还原
const faces: { axis: Axis; li: number }[] = [
  { axis: 'y', li: 2 }, // U
  { axis: 'y', li: 0 }, // D
  { axis: 'z', li: 2 }, // F
  { axis: 'z', li: 0 }, // B
  { axis: 'x', li: 2 }, // R
  { axis: 'x', li: 0 }, // L
];
for (const f of faces) {
  const cube = LogicalCube.solved(3);
  cube.applyMove(f.axis, f.li, 1);
  const st = buildStateString(cube);
  const sol = kociemba.solve(st) as string;
  const moves = solver.solve(cube);
  for (const m of moves) cube.applyMove(m.axis, m.layerIndex, m.dir);
  console.log(`${f.axis}${f.li}+ -> solution "${sol}" solved=${cube.isSolved()}`);
}
