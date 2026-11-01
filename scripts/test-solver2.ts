import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver2 } from '../src/solver/layerSolver2';
import type { Move } from '../src/types';

const moves: Move[] = [
  { axis: 'y', layerIndex: 1, dir: -1 },
  { axis: 'y', layerIndex: 1, dir: 1 },
  { axis: 'y', layerIndex: 0, dir: 1 },
  { axis: 'y', layerIndex: 0, dir: -1 },
  { axis: 'x', layerIndex: 1, dir: -1 },
  { axis: 'x', layerIndex: 1, dir: 1 },
  { axis: 'x', layerIndex: 0, dir: 1 },
  { axis: 'x', layerIndex: 0, dir: -1 },
  { axis: 'z', layerIndex: 1, dir: -1 },
  { axis: 'z', layerIndex: 1, dir: 1 },
  { axis: 'z', layerIndex: 0, dir: 1 },
  { axis: 'z', layerIndex: 0, dir: -1 },
];

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const solver = new LayerSolver2();
let ok = 0;
let fail = 0;
const TRIALS = 300;
let maxLen = 0;
let firstFailSeed = -1;
for (let seed = 1; seed <= TRIALS; seed++) {
  const rng = mulberry32(seed);
  const cube = LogicalCube.solved(2);
  const n = 12 + Math.floor(rng() * 9); // 12..20 步
  for (let i = 0; i < n; i++) {
    const m = moves[Math.floor(rng() * moves.length)];
    cube.applyMove(m.axis, m.layerIndex, m.dir);
  }
  const sol = solver.solve(cube);
  maxLen = Math.max(maxLen, sol.length);
  for (const mv of sol) cube.applyMove(mv.axis, mv.layerIndex, mv.dir);
  if (cube.isSolved()) ok++;
  else {
    fail++;
    if (firstFailSeed === -1) firstFailSeed = seed;
  }
}
console.log(`2x2 solver smoke test: ok=${ok} fail=${fail} (${TRIALS} trials), max solution len=${maxLen}`);

if (firstFailSeed !== -1) {
  const rng = mulberry32(firstFailSeed);
  const cube = LogicalCube.solved(2);
  const n = 12 + Math.floor(rng() * 9);
  for (let i = 0; i < n; i++) {
    const m = moves[Math.floor(rng() * moves.length)];
    cube.applyMove(m.axis, m.layerIndex, m.dir);
  }
  const sol = solver.solve(cube);
  for (const mv of sol) cube.applyMove(mv.axis, mv.layerIndex, mv.dir);
  console.log(`First failing seed=${firstFailSeed}, solvedAfter=${cube.isSolved()}, solLen=${sol.length}`);
}
