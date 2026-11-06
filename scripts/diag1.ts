import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver3 } from '../src/solver/layerSolver3';

const solver = new LayerSolver3();
function scramble(cube: LogicalCube, moves: Array<[any, number, 1 | -1]>): void {
  for (const [a, l, d] of moves) cube.applyMove(a, l, d);
}

function run(label: string, moves: Array<[any, number, 1 | -1]>): void {
  const cube = LogicalCube.solved(3);
  scramble(cube, moves);
  const t0 = Date.now();
  const sol = solver.solve(cube);
  const t1 = Date.now();
  let ok = false;
  if (sol.length > 0) {
    const c2 = LogicalCube.solved(3);
    scramble(c2, moves);
    for (const m of sol) c2.applyMove(m.axis, m.layerIndex, m.dir);
    ok = c2.isSolved();
  }
  console.log(`${label}: time=${t1 - t0}ms moves=${sol.length} solved=${ok}`);
}

// 已还原
run('solved', []);
// 单步
run('1move U', [['y', 2, 1]]);
run('1move R', [['x', 2, 1]]);
// 两步
run('2move', [['y', 2, 1], ['x', 2, 1]]);
// 五步随机（固定）
run('5move', [['y', 2, 1], ['x', 0, 1], ['z', 2, -1], ['y', 0, 1], ['x', 2, -1]]);
