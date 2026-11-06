import { LogicalCube } from '../src/solver/logicalCube';
import { LayerSolver3, buildStateString, tokenToMoves } from '../src/solver/layerSolver3';
import rubiksCubeSolver from 'rubiks-cube-solver';
import type { Axis, Move } from '../src/types';

const solver = new LayerSolver3();

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function faceMove(token: string, order: number): Move {
  const m = /^([RLUDFB])('|prime|2)?$/.exec(token)!;
  const face = m[1];
  const mod = m[2] ?? '';
  let axis: Axis;
  let layerIndex: number;
  let baseDir: 1 | -1;
  switch (face) {
    case 'R': axis = 'x'; layerIndex = order - 1; baseDir = -1; break;
    case 'L': axis = 'x'; layerIndex = 0; baseDir = 1; break;
    case 'U': axis = 'y'; layerIndex = order - 1; baseDir = -1; break;
    case 'D': axis = 'y'; layerIndex = 0; baseDir = 1; break;
    case 'F': axis = 'z'; layerIndex = order - 1; baseDir = -1; break;
    case 'B': axis = 'z'; layerIndex = 0; baseDir = 1; break;
    default: throw new Error('bad face');
  }
  const dir: 1 | -1 = mod === 'prime' ? (-baseDir as 1 | -1) : baseDir;
  return { axis, layerIndex, dir };
}

function scramble(cube: LogicalCube, n: number, rng: () => number): void {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
  const mods = ['', "'", '2'];
  const order = cube.order;
  for (let i = 0; i < n; i++) {
    const f = faces[Math.floor(rng() * faces.length)];
    const mod = mods[Math.floor(rng() * mods.length)];
    const mv = faceMove(f + mod, order);
    cube.applyMove(mv.axis, mv.layerIndex, mv.dir);
  }
}

let ok = 0;
let fail = 0;
const TRIALS = 500;
let firstFailSeed = -1;
for (let seed = 1; seed <= TRIALS; seed++) {
  const rng = mulberry32(seed);
  const cube = LogicalCube.solved(3);
  scramble(cube, 30, rng);
  const sol = solver.solve(cube) ?? [];
  for (const mv of sol) cube.applyMove(mv.axis, mv.layerIndex, mv.dir);
  if (cube.isSolved()) ok++;
  else {
    fail++;
    if (firstFailSeed === -1) firstFailSeed = seed;
  }
}
console.log(`3x3 solver smoke test: ok=${ok} fail=${fail} (${TRIALS} trials)`);

if (firstFailSeed !== -1) {
  const rng = mulberry32(firstFailSeed);
  const cube = LogicalCube.solved(3);
  scramble(cube, 30, rng);
  const state = buildStateString(cube);
  const counts: Record<string, number> = {};
  for (const ch of state) counts[ch] = (counts[ch] ?? 0) + 1;
  const raw = rubiksCubeSolver(state) as string;
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const unhandled = tokens.filter((tk) => tokenToMoves(tk, 3).length === 0);
  console.log(`First failing seed=${firstFailSeed}`);
  console.log(`  color counts = ${JSON.stringify(counts)}`);
  console.log(`  state string = ${state}`);
  console.log(`  unhandled tokens = ${JSON.stringify(unhandled)}`);
}
