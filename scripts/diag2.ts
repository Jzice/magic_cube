import { solve, warmup, pruneStats, twistMove, flipMove, FRtoBR_Move, getTwist, getFlip, getFRtoBR, solvedCube, applyMove } from '../src/solver/kociembaPure';

let t0 = Date.now();
warmup();
console.log('warmup time(ms):', Date.now() - t0);

console.log('pruneStats:', pruneStats());

const c = solvedCube();
applyMove(c, 3); // R quarter
console.log('after R: twist=', getTwist(c), 'flip=', getFlip(c), 'FRtoBR=', getFRtoBR(c));
console.log('twistMove[0][3]=', twistMove[0 * 18 + 3], 'flipMove[0][3]=', flipMove[0 * 18 + 3], 'FRtoBR_Move[0][3]=', FRtoBR_Move[0 * 18 + 3]);

const solvedStr = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
t0 = Date.now();
const r = solve(solvedStr);
console.log('solve solvedStr time(ms):', Date.now() - t0, 'result=', JSON.stringify(r));
