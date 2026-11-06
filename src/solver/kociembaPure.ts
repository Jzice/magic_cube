/**
 * 纯 TypeScript 移植的两阶段（Kociemba）求解器。
 *
 * 说明：本项目要求产物可离线、单文件、浏览器可用，而 npm 上的 kociemba 原生 NAPI 插件
 * 无法被打包进浏览器。因此这里从 Kociemba 算法的权威 C 实现（d-band/kociemba 的 src/*.c）
 * 忠实移植，不依赖任何原生模块。
 *
 * 坐标、移动表、剪枝表与 IDA* 搜索逻辑均与原始实现一致；输出为标准记号
 * （U/R/F/D/L/B + ' / 2），可直接由本项目的 tokenToMoves 映射为引擎动作。
 *
 * 颜色 / 面枚举约定（与原实现一致）：U=0, R=1, F=2, D=3, L=4, B=5。
 */

// ===================== 常量 =====================
const N_TWIST = 2187;
const N_FLIP = 2048;
const N_SLICE1 = 495; // 阶段1：中层组合坐标
const N_SLICE2 = 24; // 阶段2：中层排列坐标
const N_PARITY = 2;
const N_URFtoDLF = 20160;
const N_FRtoBR = 11880;
const N_URtoUL = 1320;
const N_UBtoDF = 1320;
const N_URtoDF = 20160;
const N_MOVE = 18;

// 角块 / 棱块位置枚举（保持数值）
const URF = 0, UFL = 1, ULB = 2, UBR = 3, DFR = 4, DLF = 5, DBL = 6, DRB = 7;
const UR = 0, UF = 1, UL = 2, UB = 3, DR = 4, DF = 5, DL = 6, DB = 7, FR = 8, FL = 9, BL = 10, BR = 11;
const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;

// ===================== 面片位置表（facecube.c） =====================
// facelet 索引：U1..U9=0..8, R1..R9=9..17, F1..F9=18..26, D1..D9=27..35, L1..L9=36..44, B1..B9=45..53
const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46],
  [32, 16], [28, 25], [30, 43], [34, 52],
  [23, 12], [21, 41], [50, 39], [48, 14],
];
const cornerColor: number[][] = [
  [U, R, F], [U, F, L], [U, L, B], [U, B, R],
  [D, F, R], [D, L, F], [D, B, L], [D, R, B],
];
const edgeColor: number[][] = [
  [U, R], [U, F], [U, L], [U, B],
  [D, R], [D, F], [D, L], [D, B],
  [F, R], [F, L], [B, L], [B, R],
];

// ===================== CubieCube 表示 =====================
interface CubieCube {
  cp: number[]; // 8 角块置换
  co: number[]; // 8 角块朝向
  ep: number[]; // 12 棱块置换
  eo: number[]; // 12 棱块朝向
}

function solvedCube(): CubieCube {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0,0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0,0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

function cloneCube(c: CubieCube): CubieCube {
  return { cp: c.cp.slice(), co: c.co.slice(), ep: c.ep.slice(), eo: c.eo.slice() };
}

// ===================== 基础工具 =====================
function Cnk(n: number, k: number): number {
  if (n < k) return 0;
  if (k > n / 2) k = n - k;
  let s = 1;
  for (let i = n, j = 1; i !== n - k; i--, j++) {
    s *= i;
    s /= j;
  }
  return s;
}

function rotateLeftEdge(arr: number[], l: number, r: number): void {
  const temp = arr[l];
  for (let i = l; i < r; i++) arr[i] = arr[i + 1];
  arr[r] = temp;
}
function rotateRightEdge(arr: number[], l: number, r: number): void {
  const temp = arr[r];
  for (let i = r; i > l; i--) arr[i] = arr[i - 1];
  arr[l] = temp;
}
function rotateLeftCorner(arr: number[], l: number, r: number): void {
  const temp = arr[l];
  for (let i = l; i < r; i++) arr[i] = arr[i + 1];
  arr[r] = temp;
}
function rotateRightCorner(arr: number[], l: number, r: number): void {
  const temp = arr[r];
  for (let i = r; i > l; i--) arr[i] = arr[i - 1];
  arr[l] = temp;
}

// ===================== 6 个基本转层（cubiecube.c 的 moveCube） =====================
// 每个：角块置换 cp、角块朝向 co、棱块置换 ep、棱块朝向 eo
const moveCube: CubieCube[] = [
  // U
  {
    cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // R
  {
    cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // F
  {
    cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  // D
  {
    cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // L
  {
    cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // B
  {
    cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
];

function cornerMultiply(a: CubieCube, b: CubieCube): void {
  const cPerm = new Array(8).fill(0);
  const cOri = new Array(8).fill(0);
  for (let corn = 0; corn < 8; corn++) {
    cPerm[corn] = a.cp[b.cp[corn]];
    const oriA = a.co[b.cp[corn]];
    const oriB = b.co[corn];
    let ori = oriA + oriB;
    if (ori >= 3) ori -= 3;
    cOri[corn] = ori;
  }
  a.cp = cPerm;
  a.co = cOri;
}

function edgeMultiply(a: CubieCube, b: CubieCube): void {
  const ePerm = new Array(12).fill(0);
  const eOri = new Array(12).fill(0);
  for (let edge = 0; edge < 12; edge++) {
    ePerm[edge] = a.ep[b.ep[edge]];
    eOri[edge] = (b.eo[edge] + a.eo[b.ep[edge]]) % 2;
  }
  a.ep = ePerm;
  a.eo = eOri;
}

function multiply(a: CubieCube, b: CubieCube): void {
  cornerMultiply(a, b);
  edgeMultiply(a, b);
}

/** 应用一次记号 mv（0..17）：mv = 3*轴 + (pow-1)，即把对应基本转层执行 pow 次。 */
function applyMove(cube: CubieCube, mv: number): void {
  const j = Math.floor(mv / 3);
  const reps = (mv % 3) + 1;
  for (let r = 0; r < reps; r++) multiply(cube, moveCube[j]);
}

// ===================== 坐标函数（cubiecube.c） =====================
function getTwist(c: CubieCube): number {
  let ret = 0;
  for (let i = URF; i < DRB; i++) ret = 3 * ret + c.co[i];
  return ret;
}
function setTwist(c: CubieCube, twist: number): void {
  let t = twist;
  let parity = 0;
  for (let i = DRB - 1; i >= URF; i--) {
    c.co[i] = t % 3;
    parity += c.co[i];
    t = Math.floor(t / 3);
  }
  c.co[DRB] = (3 - (parity % 3)) % 3;
}

function getFlip(c: CubieCube): number {
  let ret = 0;
  for (let i = UR; i < BR; i++) ret = 2 * ret + c.eo[i];
  return ret;
}
function setFlip(c: CubieCube, flip: number): void {
  let f = flip;
  let parity = 0;
  for (let i = BR - 1; i >= UR; i--) {
    c.eo[i] = f % 2;
    parity += c.eo[i];
    f = Math.floor(f / 2);
  }
  c.eo[BR] = (2 - (parity % 2)) % 2;
}

function cornerParity(c: CubieCube): number {
  let s = 0;
  for (let i = DRB; i >= URF + 1; i--)
    for (let j = i - 1; j >= URF; j--) if (c.cp[j] > c.cp[i]) s++;
  return s % 2;
}

function getFRtoBR(c: CubieCube): number {
  let a = 0, x = 0, b = 0;
  const edge4: number[] = [0, 0, 0, 0];
  for (let j = BR; j >= UR; j--)
    if (FR <= c.ep[j] && c.ep[j] <= BR) {
      a += Cnk(11 - j, x + 1);
      edge4[3 - x++] = c.ep[j];
    }
  for (let j = 3; j > 0; j--) {
    let k = 0;
    while (edge4[j] !== j + 8) {
      rotateLeftEdge(edge4, 0, j);
      k++;
    }
    b = (j + 1) * b + k;
  }
  return 24 * a + b;
}
function setFRtoBR(c: CubieCube, idx: number): void {
  let a = idx;
  const b = idx % 24;
  const sliceEdge: number[] = [FR, FL, BL, BR];
  const otherEdge: number[] = [UR, UF, UL, UB, DR, DF, DL, DB];
  a = Math.floor(a / 24);
  for (let e = 0; e < 12; e++) c.ep[e] = DB; // 用 DB 作占位（无效）
  let x = 3;
  for (let j = 1; j < 4; j++) {
    let k = b % (j + 1);
    a = Math.floor(a / (j + 1));
    while (k-- > 0) rotateRightEdge(sliceEdge, 0, j);
  }
  x = 3;
  for (let j = UR; j <= BR; j++)
    if (a - Cnk(11 - j, x + 1) >= 0) {
      c.ep[j] = sliceEdge[3 - x];
      a -= Cnk(11 - j, x-- + 1);
    }
  x = 0;
  for (let j = UR; j <= BR; j++) if (c.ep[j] === DB) c.ep[j] = otherEdge[x++];
}

function getURFtoDLF(c: CubieCube): number {
  let a = 0, x = 0, b = 0;
  const corner6: number[] = [0, 0, 0, 0, 0, 0];
  for (let j = URF; j <= DRB; j++)
    if (c.cp[j] <= DLF) {
      a += Cnk(j, x + 1);
      corner6[x++] = c.cp[j];
    }
  for (let j = 5; j > 0; j--) {
    let k = 0;
    while (corner6[j] !== j) {
      rotateLeftCorner(corner6, 0, j);
      k++;
    }
    b = (j + 1) * b + k;
  }
  return 720 * a + b;
}
function setURFtoDLF(c: CubieCube, idx: number): void {
  let a = idx;
  const b = idx % 720;
  const corner6: number[] = [URF, UFL, ULB, UBR, DFR, DLF];
  const otherCorner: number[] = [DBL, DRB];
  a = Math.floor(a / 720);
  for (let e = 0; e < 8; e++) c.cp[e] = DRB; // 用 DRB 占位
  for (let j = 1; j < 6; j++) {
    let k = b % (j + 1);
    a = Math.floor(a / (j + 1));
    while (k-- > 0) rotateRightCorner(corner6, 0, j);
  }
  let x = 5;
  for (let j = DRB; j >= 0; j--)
    if (a - Cnk(j, x + 1) >= 0) {
      c.cp[j] = corner6[x];
      a -= Cnk(j, x-- + 1);
    }
  x = 0;
  for (let j = URF; j <= DRB; j++) if (c.cp[j] === DRB) c.cp[j] = otherCorner[x++];
}

function getURtoDF(c: CubieCube): number {
  let a = 0, x = 0, b = 0;
  const edge6: number[] = [0, 0, 0, 0, 0, 0];
  for (let j = UR; j <= BR; j++)
    if (c.ep[j] <= DF) {
      a += Cnk(11 - j, x + 1);
      edge6[x++] = c.ep[j];
    }
  for (let j = 5; j > 0; j--) {
    let k = 0;
    while (edge6[j] !== j) {
      rotateLeftEdge(edge6, 0, j);
      k++;
    }
    b = (j + 1) * b + k;
  }
  return 720 * a + b;
}
function setURtoDF(c: CubieCube, idx: number): void {
  let a = idx;
  const b = idx % 720;
  const edge6: number[] = [UR, UF, UL, UB, DR, DF];
  const otherEdge: number[] = [DL, DB, FR, FL, BL, BR];
  a = Math.floor(a / 720);
  for (let e = 0; e < 12; e++) c.ep[e] = BR; // 用 BR 占位
  for (let j = 1; j < 6; j++) {
    let k = b % (j + 1);
    a = Math.floor(a / (j + 1));
    while (k-- > 0) rotateRightEdge(edge6, 0, j);
  }
  let x = 5;
  for (let j = BR; j >= 0; j--)
    if (a - Cnk(j, x + 1) >= 0) {
      c.ep[j] = edge6[x];
      a -= Cnk(j, x-- + 1);
    }
  x = 0;
  for (let j = UR; j <= BR; j++) if (c.ep[j] === BR) c.ep[j] = otherEdge[x++];
}

function getURtoUL(c: CubieCube): number {
  let a = 0, x = 0, b = 0;
  const edge3: number[] = [0, 0, 0];
  for (let j = UR; j <= BR; j++)
    if (c.ep[j] <= UL) {
      a += Cnk(11 - j, x + 1);
      edge3[x++] = c.ep[j];
    }
  for (let j = 2; j > 0; j--) {
    let k = 0;
    while (edge3[j] !== j) {
      rotateLeftEdge(edge3, 0, j);
      k++;
    }
    b = (j + 1) * b + k;
  }
  return 6 * a + b;
}
function setURtoUL(c: CubieCube, idx: number): void {
  let a = Math.floor(idx / 6);
  const b = idx % 6;
  const edge3: number[] = [UR, UF, UL];
  for (let e = 0; e < 12; e++) c.ep[e] = BR; // 用 BR 占位（其余由后续步骤填入）
  for (let j = 1; j < 3; j++) {
    let k = b % (j + 1);
    a = Math.floor(a / (j + 1));
    while (k-- > 0) rotateRightEdge(edge3, 0, j);
  }
  let x = 2;
  for (let j = BR; j >= 0; j--)
    if (a - Cnk(j, x + 1) >= 0) {
      c.ep[j] = edge3[x];
      a -= Cnk(j, x-- + 1);
    }
}

function getUBtoDF(c: CubieCube): number {
  let a = 0, x = 0, b = 0;
  const edge3: number[] = [0, 0, 0];
  for (let j = UR; j <= BR; j++)
    if (UB <= c.ep[j] && c.ep[j] <= DF) {
      a += Cnk(11 - j, x + 1);
      edge3[x++] = c.ep[j];
    }
  for (let j = 2; j > 0; j--) {
    let k = 0;
    while (edge3[j] !== UB + j) {
      rotateLeftEdge(edge3, 0, j);
      k++;
    }
    b = (j + 1) * b + k;
  }
  return 6 * a + b;
}
function setUBtoDF(c: CubieCube, idx: number): void {
  let a = Math.floor(idx / 6);
  const b = idx % 6;
  const edge3: number[] = [UB, DR, DF];
  for (let e = 0; e < 12; e++) c.ep[e] = BR; // 用 BR 占位
  for (let j = 1; j < 3; j++) {
    let k = b % (j + 1);
    a = Math.floor(a / (j + 1));
    while (k-- > 0) rotateRightEdge(edge3, 0, j);
  }
  let x = 2;
  for (let j = BR; j >= 0; j--)
    if (a - Cnk(j, x + 1) >= 0) {
      c.ep[j] = edge3[x];
      a -= Cnk(j, x-- + 1);
    }
}

function getURtoDF_standalone(idx1: number, idx2: number): number {
  const a = solvedCube();
  const b = solvedCube();
  setURtoUL(a, idx1);
  setUBtoDF(b, idx2);
  for (let i = 0; i < 12; i++) {
    if (a.ep[i] !== BR) {
      if (b.ep[i] !== BR) return -1; // 冲突
      b.ep[i] = a.ep[i];
    }
  }
  return getURtoDF(b);
}

// ===================== facelet -> cubie =====================
const CHAR_TO_COLOR: Record<string, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

function toCubieCube(facelets: string): CubieCube | null {
  const f: number[] = new Array(54).fill(-1);
  for (let i = 0; i < 54; i++) {
    const ch = facelets[i];
    if (!(ch in CHAR_TO_COLOR)) return null;
    f[i] = CHAR_TO_COLOR[ch];
  }
  const c = solvedCube();
  // 角块
  for (let i = 0; i < 8; i++) {
    let ori = 0;
    for (ori = 0; ori < 3; ori++)
      if (f[cornerFacelet[i][ori]] === U || f[cornerFacelet[i][ori]] === D) break;
    const col1 = f[cornerFacelet[i][(ori + 1) % 3]];
    const col2 = f[cornerFacelet[i][(ori + 2) % 3]];
    let found = -1;
    for (let j = 0; j < 8; j++) {
      if (cornerColor[j][1] === col1 && cornerColor[j][2] === col2) {
        found = j;
        break;
      }
    }
    if (found === -1) return null;
    c.cp[i] = found;
    c.co[i] = ori % 3;
  }
  // 棱块
  for (let i = 0; i < 12; i++) {
    let found = -1;
    let o = 0;
    for (let j = 0; j < 12; j++) {
      if (f[edgeFacelet[i][0]] === edgeColor[j][0] && f[edgeFacelet[i][1]] === edgeColor[j][1]) {
        found = j; o = 0; break;
      }
      if (f[edgeFacelet[i][0]] === edgeColor[j][1] && f[edgeFacelet[i][1]] === edgeColor[j][0]) {
        found = j; o = 1; break;
      }
    }
    if (found === -1) return null;
    c.ep[i] = found;
    c.eo[i] = o;
  }
  return c;
}

function verify(c: CubieCube): number {
  const edgeCount = new Array(12).fill(0);
  const cornerCount = new Array(8).fill(0);
  for (let e = 0; e < 12; e++) edgeCount[c.ep[e]]++;
  for (let i = 0; i < 12; i++) if (edgeCount[i] !== 1) return -2;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += c.eo[i];
  if (sum % 2 !== 0) return -3;
  for (let cc = 0; cc < 8; cc++) cornerCount[c.cp[cc]]++;
  for (let i = 0; i < 8; i++) if (cornerCount[i] !== 1) return -4;
  sum = 0;
  for (let i = 0; i < 8; i++) sum += c.co[i];
  if (sum % 3 !== 0) return -5;
  // parity
  const cornerPar = cornerParity(c);
  let edgePar = 0;
  for (let i = BR; i >= UR + 1; i--)
    for (let j = i - 1; j >= UR; j--) if (c.ep[j] > c.ep[i]) edgePar++;
  edgePar %= 2;
  if ((edgePar ^ cornerPar) !== 0) return -6;
  return 0;
}

// ===================== 移动表 / 剪枝表 =====================
let twistMove!: Int32Array;
let flipMove!: Int32Array;
let FRtoBR_Move!: Int32Array;
let URFtoDLF_Move!: Int32Array;
let URtoDF_Move!: Int32Array;
let URtoUL_Move!: Int32Array;
let UBtoDF_Move!: Int32Array;
let MergeURtoULandUBtoDF!: Int32Array;

let Slice_URFtoDLF_Parity_Prun!: Int8Array;
let Slice_URtoDF_Parity_Prun!: Int8Array;
let Slice_Twist_Prun!: Int8Array;
let Slice_Flip_Prun!: Int8Array;

let PRUNING_INITED = false;

function genCoordTable(
  N: number,
  setX: (c: CubieCube, i: number) => void,
  getX: (c: CubieCube) => number,
): Int32Array {
  const tbl = new Int32Array(N * N_MOVE);
  for (let i = 0; i < N; i++) {
    const a = solvedCube();
    setX(a, i);
    for (let mv = 0; mv < N_MOVE; mv++) {
      const b = cloneCube(a);
      applyMove(b, mv);
      tbl[i * N_MOVE + mv] = getX(b);
    }
  }
  return tbl;
}

/** 用前沿 BFS 计算剪枝表（结果与原实现的逐层扫描一致）。 */
function buildPruning(
  size: number,
  moves: number[],
  trans: (idx: number, mv: number) => number,
): Int8Array {
  const tbl = new Int8Array(size).fill(-1);
  tbl[0] = 0;
  let frontier: number[] = [0];
  let depth = 0;
  while (frontier.length && depth < 20) {
    const next: number[] = [];
    for (const idx of frontier) {
      for (const mv of moves) {
        const ni = trans(idx, mv);
        if (tbl[ni] === -1) {
          tbl[ni] = depth + 1;
          next.push(ni);
        }
      }
    }
    frontier = next;
    depth++;
  }
  return tbl;
}

const PARITY_MOVE: number[][] = [
  [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
];

// 阶段2允许的 10 个移动（与原始实现 initPruning 中保留的 j 一致）
const PHASE2_MOVES = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];

function initPruning(): void {
  if (PRUNING_INITED) return;
  twistMove = genCoordTable(N_TWIST, setTwist, getTwist);
  flipMove = genCoordTable(N_FLIP, setFlip, getFlip);
  FRtoBR_Move = genCoordTable(N_FRtoBR, setFRtoBR, getFRtoBR);
  URFtoDLF_Move = genCoordTable(N_URFtoDLF, setURFtoDLF, getURFtoDLF);
  URtoDF_Move = genCoordTable(N_URtoDF, setURtoDF, getURtoDF);
  URtoUL_Move = genCoordTable(N_URtoUL, setURtoUL, getURtoUL);
  UBtoDF_Move = genCoordTable(N_UBtoDF, setUBtoDF, getUBtoDF);

  MergeURtoULandUBtoDF = new Int32Array(336 * 336);
  for (let u = 0; u < 336; u++)
    for (let v = 0; v < 336; v++)
      MergeURtoULandUBtoDF[u * 336 + v] = getURtoDF_standalone(u, v);

  // 阶段1 剪枝表（全部 18 个移动）
  Slice_Twist_Prun = buildPruning(
    Math.floor(N_SLICE1 * N_TWIST / 2 + 1) * 2,
    Array.from({ length: 18 }, (_, i) => i),
    (idx, mv) => {
      const twist = Math.floor(idx / N_SLICE1);
      const slice = idx % N_SLICE1;
      const nt = twistMove[twist * N_MOVE + mv];
      const ns = Math.floor(FRtoBR_Move[slice * 24 * N_MOVE + mv] / 24);
      return N_SLICE1 * nt + ns;
    },
  );
  Slice_Flip_Prun = buildPruning(
    N_SLICE1 * N_FLIP,
    Array.from({ length: 18 }, (_, i) => i),
    (idx, mv) => {
      const flip = Math.floor(idx / N_SLICE1);
      const slice = idx % N_SLICE1;
      const nf = flipMove[flip * N_MOVE + mv];
      const ns = Math.floor(FRtoBR_Move[slice * 24 * N_MOVE + mv] / 24);
      return N_SLICE1 * nf + ns;
    },
  );
  // 阶段2 剪枝表（10 个移动）
  Slice_URFtoDLF_Parity_Prun = buildPruning(
    N_SLICE2 * N_URFtoDLF * N_PARITY,
    PHASE2_MOVES,
    (idx, mv) => {
      const parity = idx % N_PARITY;
      const rest = Math.floor(idx / N_PARITY);
      const URFtoDLF = Math.floor(rest / N_SLICE2);
      const FRtoBR = rest % N_SLICE2;
      const nu = URFtoDLF_Move[URFtoDLF * N_MOVE + mv];
      const nf = FRtoBR_Move[FRtoBR * N_MOVE + mv];
      const np = PARITY_MOVE[parity][mv];
      return (N_SLICE2 * nu + nf) * N_PARITY + np;
    },
  );
  Slice_URtoDF_Parity_Prun = buildPruning(
    N_SLICE2 * N_URtoDF * N_PARITY,
    PHASE2_MOVES,
    (idx, mv) => {
      const parity = idx % N_PARITY;
      const rest = Math.floor(idx / N_PARITY);
      const URtoDF = Math.floor(rest / N_SLICE2);
      const FRtoBR = rest % N_SLICE2;
      const nu = URtoDF_Move[URtoDF * N_MOVE + mv];
      const nf = FRtoBR_Move[FRtoBR * N_MOVE + mv];
      const np = PARITY_MOVE[parity][mv];
      return (N_SLICE2 * nu + nf) * N_PARITY + np;
    },
  );

  PRUNING_INITED = true;
}

function getPruning(tbl: Int8Array, idx: number): number {
  return tbl[idx];
}

// ===================== 搜索（search.c） =====================
interface CoordCube {
  twist: number; flip: number; parity: number; FRtoBR: number;
  URFtoDLF: number; URtoUL: number; UBtoDF: number; URtoDF: number;
}

function getCoordCube(c: CubieCube): CoordCube {
  return {
    twist: getTwist(c),
    flip: getFlip(c),
    parity: cornerParity(c),
    FRtoBR: getFRtoBR(c),
    URFtoDLF: getURFtoDLF(c),
    URtoUL: getURtoUL(c),
    UBtoDF: getUBtoDF(c),
    URtoDF: getURtoDF(c),
  };
}

function solutionToString(ax: number[], po: number[], length: number): string {
  const tokens: string[] = [];
  const FACE = ['U', 'R', 'F', 'D', 'L', 'B'];
  for (let i = 0; i < length; i++) {
    let t = FACE[ax[i]];
    if (po[i] === 2) t += '2';
    else if (po[i] === 3) t += "'";
    tokens.push(t);
  }
  return tokens.join(' ');
}

function totalDepth(
  ax: number[], po: number[], depthPhase1: number, maxDepth: number,
  c: CoordCube,
): number {
  (globalThis as any).__dbg && ((globalThis as any).__dbg.totalCalls++);
  const maxDepthPhase2 = Math.min(10, maxDepth - depthPhase1);
  const URFtoDLF = new Array(31).fill(0);
  const FRtoBR = new Array(31).fill(0);
  const parity = new Array(31).fill(0);
  const URtoUL = new Array(31).fill(0);
  const UBtoDF = new Array(31).fill(0);
  const URtoDF = new Array(31).fill(0);
  const minDistPhase2 = new Array(31).fill(0);

  // 阶段1 结束时的坐标（来自初始状态沿前 depthPhase1 步）
  URFtoDLF[0] = c.URFtoDLF;
  FRtoBR[0] = c.FRtoBR;
  parity[0] = c.parity;
  URtoUL[0] = c.URtoUL;
  UBtoDF[0] = c.UBtoDF;

  for (let i = 0; i < depthPhase1; i++) {
    const mv = 3 * ax[i] + po[i] - 1;
    URFtoDLF[i + 1] = URFtoDLF_Move[URFtoDLF[i] * N_MOVE + mv];
    FRtoBR[i + 1] = FRtoBR_Move[FRtoBR[i] * N_MOVE + mv];
    parity[i + 1] = PARITY_MOVE[parity[i]][mv];
  }
  let d1 = getPruning(
    Slice_URFtoDLF_Parity_Prun,
    (N_SLICE2 * URFtoDLF[depthPhase1] + FRtoBR[depthPhase1]) * N_PARITY + parity[depthPhase1],
  );
  if (d1 > maxDepthPhase2) return -1;

  for (let i = 0; i < depthPhase1; i++) {
    const mv = 3 * ax[i] + po[i] - 1;
    URtoUL[i + 1] = URtoUL_Move[URtoUL[i] * N_MOVE + mv];
    UBtoDF[i + 1] = UBtoDF_Move[UBtoDF[i] * N_MOVE + mv];
  }
  URtoDF[depthPhase1] = MergeURtoULandUBtoDF[URtoUL[depthPhase1] * 336 + UBtoDF[depthPhase1]];

  const d2 = getPruning(
    Slice_URtoDF_Parity_Prun,
    (N_SLICE2 * URtoDF[depthPhase1] + FRtoBR[depthPhase1]) * N_PARITY + parity[depthPhase1],
  );
  if (d2 > maxDepthPhase2) return -1;

  if ((minDistPhase2[depthPhase1] = Math.max(d1, d2)) === 0) {
    (globalThis as any).__dbg && ((globalThis as any).__dbg.retDepth1++);
    return depthPhase1;
  }
  if (depthPhase1 === 1 && (globalThis as any).__dbg) {
    (globalThis as any).__dbg.d1d2 = (globalThis as any).__dbg.d1d2 || [];
    if ((globalThis as any).__dbg.d1d2.length < 6) {
      (globalThis as any).__dbg.d1d2.push({
        d1, d2, URFtoDLF1: URFtoDLF[depthPhase1], URtoDF1: URtoDF[depthPhase1],
        FRtoBR1: FRtoBR[depthPhase1], parity1: parity[depthPhase1], maxDP2: maxDepthPhase2,
      });
    }
  }

  let depthPhase2 = 1;
  let n = depthPhase1;
  let busy = 0;
  po[depthPhase1] = 0;
  ax[depthPhase1] = 0;
  minDistPhase2[n + 1] = 1;

  do {
    do {
      if (depthPhase1 + depthPhase2 - n > minDistPhase2[n + 1] && !busy) {
        if (ax[n] === 0 || ax[n] === 3) { ax[++n] = 1; po[n] = 2; }
        else { ax[++n] = 0; po[n] = 1; }
      } else if (
        (ax[n] === 0 || ax[n] === 3) ? (++po[n] > 3) : ((po[n] = po[n] + 2) > 3)
      ) {
        do {
          if (++ax[n] > 5) {
            if (n === depthPhase1) {
              if (depthPhase2 >= maxDepthPhase2) return -1;
              else { depthPhase2++; ax[n] = 0; po[n] = 1; busy = 0; break; }
            } else { n--; busy = 1; break; }
          } else {
            if (ax[n] === 0 || ax[n] === 3) po[n] = 1;
            else po[n] = 2;
            busy = 0;
          }
        } while (n !== depthPhase1 && (ax[n - 1] === ax[n] || ax[n - 1] - 3 === ax[n]));
      } else busy = 0;
    } while (busy);

    const mv = 3 * ax[n] + po[n] - 1;
    URFtoDLF[n + 1] = URFtoDLF_Move[URFtoDLF[n] * N_MOVE + mv];
    FRtoBR[n + 1] = FRtoBR_Move[FRtoBR[n] * N_MOVE + mv];
    parity[n + 1] = PARITY_MOVE[parity[n]][mv];
    URtoDF[n + 1] = URtoDF_Move[URtoDF[n] * N_MOVE + mv];
    minDistPhase2[n + 1] = Math.max(
      getPruning(
        Slice_URtoDF_Parity_Prun,
        (N_SLICE2 * URtoDF[n + 1] + FRtoBR[n + 1]) * N_PARITY + parity[n + 1],
      ),
      getPruning(
        Slice_URFtoDLF_Parity_Prun,
        (N_SLICE2 * URFtoDLF[n + 1] + FRtoBR[n + 1]) * N_PARITY + parity[n + 1],
      ),
    );
  } while (minDistPhase2[n + 1] !== 0);

  return depthPhase1 + depthPhase2;
}

function solution(facelets: string, maxDepth: number, timeOut: number): string | null {
  initPruning();

  // 校验颜色数量
  const count = new Array(6).fill(0);
  for (let i = 0; i < 54; i++) {
    const ch = facelets[i];
    if (!(ch in CHAR_TO_COLOR)) return null;
    count[CHAR_TO_COLOR[ch]]++;
  }
  for (let i = 0; i < 6; i++) if (count[i] !== 9) return null;

  const cc = toCubieCube(facelets);
  if (!cc) return null;
  if (verify(cc) !== 0) return null;

  const c = getCoordCube(cc);

  const ax = new Array(31).fill(0);
  const po = new Array(31).fill(0);
  const flip = new Array(31).fill(0);
  const twist = new Array(31).fill(0);
  const slice = new Array(31).fill(0);
  const parity = new Array(31).fill(0);
  const URFtoDLF = new Array(31).fill(0);
  const FRtoBR = new Array(31).fill(0);
  const URtoUL = new Array(31).fill(0);
  const UBtoDF = new Array(31).fill(0);
  const minDistPhase1 = new Array(31).fill(0);

  po[0] = 0; ax[0] = 0;
  flip[0] = c.flip; twist[0] = c.twist; parity[0] = c.parity;
  slice[0] = Math.floor(c.FRtoBR / 24);
  URFtoDLF[0] = c.URFtoDLF; FRtoBR[0] = c.FRtoBR;
  URtoUL[0] = c.URtoUL; UBtoDF[0] = c.UBtoDF;
  minDistPhase1[1] = 1;

  let mv = 0;
  let n = 0;
  let busy = 0;
  let depthPhase1 = 1;
  const tStart = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if ((globalThis as any).__dbg) {
      (globalThis as any).__dbg.iter = ((globalThis as any).__dbg.iter || 0) + 1;
      if ((globalThis as any).__dbg.iter > 200000) {
        (globalThis as any).__dbg.aborted = true;
        return null;
      }
    }
    do {
      if (depthPhase1 - n > minDistPhase1[n + 1] && !busy) {
        if (ax[n] === 0 || ax[n] === 3) ax[++n] = 1;
        else ax[++n] = 0;
        po[n] = 1;
      } else if (++po[n] > 3) {
        do {
          if (++ax[n] > 5) {
            if (Date.now() - tStart > timeOut) return null;
            if (n === 0) {
              if (depthPhase1 >= maxDepth) return null;
              else { depthPhase1++; ax[n] = 0; po[n] = 1; busy = 0; break; }
            } else { n--; busy = 1; break; }
          } else { po[n] = 1; busy = 0; }
        } while (n !== 0 && (ax[n - 1] === ax[n] || ax[n - 1] - 3 === ax[n]));
      } else busy = 0;
    } while (busy);

    mv = 3 * ax[n] + po[n] - 1;
    flip[n + 1] = flipMove[flip[n] * N_MOVE + mv];
    twist[n + 1] = twistMove[twist[n] * N_MOVE + mv];
    slice[n + 1] = Math.floor(FRtoBR_Move[slice[n] * 24 * N_MOVE + mv] / 24);
    minDistPhase1[n + 1] = Math.max(
      getPruning(Slice_Flip_Prun, N_SLICE1 * flip[n + 1] + slice[n + 1]),
      getPruning(Slice_Twist_Prun, N_SLICE1 * twist[n + 1] + slice[n + 1]),
    );

    if (minDistPhase1[n + 1] === 0 && n >= depthPhase1 - 5) {
      minDistPhase1[n + 1] = 10;
      if (n === depthPhase1 - 1) {
        const s = totalDepth(ax, po, depthPhase1, maxDepth, c);
        if (s >= 0) {
          if (
            s === depthPhase1 ||
            (ax[depthPhase1 - 1] !== ax[depthPhase1] && ax[depthPhase1 - 1] !== ax[depthPhase1] + 3)
          ) {
            return solutionToString(ax, po, s);
          }
        }
      }
    }
  }
}

/** 对外接口：输入 54 字符状态串（U,R,F,D,L,B 顺序），返回标准记号解法或 null。 */
export function solve(state: string): string | null {
  return solution(state, 21, 20000);
}

/** 预热剪枝表（可在空闲时调用，避免首次求解卡顿）。 */
export function warmup(): void {
  initPruning();
}

// ===== 诊断导出（仅供测试脚本使用） =====
export function initTables(): void {
  initPruning();
}
export function pruneStats(): Record<string, { len: number; zero: number; neg: number; max: number }> {
  const f = (t: Int8Array) => {
    let zero = 0, neg = 0, max = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === 0) zero++;
      else if (t[i] < 0) neg++;
      else if (t[i] > max) max = t[i];
    }
    return { len: t.length, zero, neg, max };
  };
  return {
    Slice_Twist: f(Slice_Twist_Prun),
    Slice_Flip: f(Slice_Flip_Prun),
    Slice_URFtoDLF: f(Slice_URFtoDLF_Parity_Prun),
    Slice_URtoDF: f(Slice_URtoDF_Parity_Prun),
  };
}
export { twistMove, flipMove, FRtoBR_Move, getTwist, getFlip, getFRtoBR, solvedCube, applyMove };
export {
  getURtoUL, getUBtoDF, getURtoDF, getURtoDF_standalone, setURtoUL, setUBtoDF, MergeURtoULandUBtoDF,
  URtoUL_Move, UBtoDF_Move, getCoordCube, URFtoDLF_Move, URtoDF_Move,
};
export function applyMoveExport(c: any, mv: number): void { applyMove(c, mv); }
