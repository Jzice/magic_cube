import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver3 } from '../src/solver/layerSolver3';

const dbg: any = { totalCalls: 0, retDepth1: 0, iter: 0, aborted: false };
(globalThis as any).__dbg = dbg;

const solver = new LayerSolver3();

// 1 步打乱 U
const cube = LogicalCube.solved(3);
cube.applyMove('y', 2, 1);
console.log('scrambled solved?', cube.isSolved());

const t0 = Date.now();
const r = solver.solve(cube);
console.log('time(ms):', Date.now() - t0);
console.log('result:', JSON.stringify(r));
console.log('dbg:', dbg);
