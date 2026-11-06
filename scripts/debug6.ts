import { LogicalCube } from '../src/solver/logicalCube';
import { buildStateString } from '../src/solver/layerSolver3';
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

// 颜色 -> 索引（与 color.h 一致：U=0,D=1,R=2,L=3,F=4,B=5）
const COL: Record<string, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const cornerFacelet = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const cornerColor = [
  [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
  [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
];
const edgeFacelet = [
  [5, 10], [7, 19], [3,37], [1,46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const edgeColor = [
  [0, 2], [0, 4], [0, 3], [0, 5], [1, 2], [1, 4], [1, 3], [1, 5],
  [4, 2], [4, 3], [5, 3], [5, 2],
];

function validate(s: string) {
  const f = s.split('').map((c) => COL[c]);
  const cp = new Array(8).fill(-1);
  const co = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    let ori = -1;
    for (let o = 0; o < 3; o++) {
      const v = f[cornerFacelet[i][o]];
      if (v === 0 || v === 1) { ori = o; break; }
    }
    if (ori < 0) return `corner ${i}: 无 U/D 面元`;
    const c1 = f[cornerFacelet[i][(ori + 1) % 3]];
    const c2 = f[cornerFacelet[i][(ori + 2) % 3]];
    let found = -1;
    for (let j = 0; j < 8; j++) {
      if (c1 === cornerColor[j][1] && c2 === cornerColor[j][2]) { found = j; co[i] = ori % 3; break; }
    }
    if (found < 0) return `corner ${i}: 组合 ${c1},${c2} 非法`;
    cp[i] = found;
  }
  if (new Set(cp).size !== 8) return `corner 排列重复: ${cp}`;
  const cosum = co.reduce((a, b) => a + b, 0) % 3;
  if (cosum !== 0) return `corner 扭转和 %3=${cosum}`;
  // 奇偶校验：cp 与 ep 同奇偶
  const cpPar = parity(cp);
  const epTest = new Array(12).fill(-1);
  const eo = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const a = f[edgeFacelet[i][0]], b = f[edgeFacelet[i][1]];
    let found = -1;
    for (let j = 0; j < 12; j++) {
      if ((a === edgeColor[j][0] && b === edgeColor[j][1])) { found = j; eo[i] = 0; break; }
      if ((a === edgeColor[j][1] && b === edgeColor[j][0])) { found = j; eo[i] = 1; break; }
    }
    if (found < 0) return `edge ${i}: 组合 ${a},${b} 非法`;
    epTest[i] = found;
  }
  if (new Set(epTest).size !== 12) return `edge 排列重复: ${epTest}`;
  const epPar = parity(epTest);
  if (cpPar !== epPar) return `奇偶不一致 cp=${cpPar} ep=${epPar}`;
  return 'OK';
}
function parity(p: number[]): number {
  let inv = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inv++;
  return inv % 2;
}

for (let t = 0; t < 100; t++) {
  const cube = LogicalCube.solved(3);
  rand(cube, 25);
  if (cube.isSolved()) continue;
  const st = buildStateString(cube);
  const v = validate(st);
  if (v !== 'OK') { console.log('INVALID t=', t, ':', v, 'state', st); break; }
}
console.log('scanned');
