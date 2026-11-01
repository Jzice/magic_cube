import type { Move, Solver } from '../types';
import { LogicalCube } from './logicalCube';
import { rotateVector } from '../core/geometry';

/**
 * 2 阶魔方求解器。
 *
 * 2x2 没有中心块，只有 8 个角块。这里用 IDA*（迭代加深 A*）搜索，
 * 配合两个轻量模式数据库（PDB）做可采纳启发式：
 *   - 角块排列 PDB：40320 个状态（8!），BFS 预计算。
 *   - 角块朝向 PDB：6561 个状态（3^8），BFS 预计算（仅其中 2187 个合法）。
 * 两者取 max 作为启发式（可采纳），可在 2x2 的「上帝之数」14 步内收敛。
 *
 * 为获得精确且一致的转层效果，本模块直接复用 LogicalCube.applyMove，
 * 并预计算 12 个标准面转（U/D/L/R/F/B × 2 方向）在 (排列,朝向) 抽象空间上的迁移表，
 * 使 IDA* 搜索不依赖每步克隆完整逻辑魔方，速度足够快。
 */

const ORDER = 2;
const N_POS = 8;

/** 位置索引：x*4 + y*2 + z，覆盖 {0,1}^3 的 8 个角块。 */
function posIndex(x: number, y: number, z: number): number {
  return x * 4 + y * 2 + z;
}

/** 还原态某位置的三个面颜色（与 FACE_CENTER_COLOR 约定一致）。 */
function cornerColors(x: number, y: number, z: number): string[] {
  return [x === 1 ? 'R' : 'O', y === 1 ? 'W' : 'Y', z === 1 ? 'G' : 'B'];
}

function colorKey(colors: string[]): string {
  return [...colors].sort().join(',');
}

/** 由 LogicalCube(2) 抽取 (排列, 朝向)。 */
export function extract(cube: LogicalCube): { perm: number[]; orient: number[] } {
  // 还原态角块身份：位置 -> 颜色集合 -> 身份 0..7
  const identityByKey = new Map<string, number>();
  for (let x = 0; x < 2; x++)
    for (let y = 0; y < 2; y++)
      for (let z = 0; z < 2; z++) {
        identityByKey.set(colorKey(cornerColors(x, y, z)), posIndex(x, y, z));
      }

  const perm = new Array<number>(N_POS).fill(-1);
  const orient = new Array<number>(N_POS).fill(0);
  for (const p of cube.pieces) {
    const idx = posIndex(p.pos.x, p.pos.y, p.pos.z);
    const key = colorKey([...p.normals.keys()]);
    perm[idx] = identityByKey.get(key) ?? -1;
    // 朝向：看该角块自身的 U/D 颜色（W 或 Y）当前指向哪个轴。
    let yc = '';
    for (const c of p.normals.keys()) if (c === 'W' || c === 'Y') { yc = c; break; }
    const v = p.normals.get(yc)!;
    let o: number;
    if (Math.abs(v.y) > 0.5) o = 0;
    else if (Math.abs(v.x) > 0.5) o = 1;
    else o = 2;
    orient[idx] = o;
  }
  return { perm, orient };
}

/** 12 个标准面转（与 faceInfo 约定一致，order=2）。 */
export function faceMoves(): Move[] {
  return [
    { axis: 'y', layerIndex: 1, dir: -1 }, // U
    { axis: 'y', layerIndex: 1, dir: 1 }, //  U'
    { axis: 'y', layerIndex: 0, dir: 1 }, //  D
    { axis: 'y', layerIndex: 0, dir: -1 }, // D'
    { axis: 'x', layerIndex: 1, dir: -1 }, // R
    { axis: 'x', layerIndex: 1, dir: 1 }, //  R'
    { axis: 'x', layerIndex: 0, dir: 1 }, //  L
    { axis: 'x', layerIndex: 0, dir: -1 }, // L'
    { axis: 'z', layerIndex: 1, dir: -1 }, // F
    { axis: 'z', layerIndex: 1, dir: 1 }, //  F'
    { axis: 'z', layerIndex: 0, dir: 1 }, //  B
    { axis: 'z', layerIndex: 0, dir: -1 }, // B'
  ];
}

interface Transition {
  newPos: number[];
  /** 朝向迁移是「指向轴」的置换（非模 3 加法）：oPerm[旧朝向码] = 新朝向码。 */
  oPerm: number[];
}

/** 由旋转方向得到朝向码（0=Y 轴, 1=X 轴, 2=Z 轴，忽略正负）。 */
function axisCode(v: { x: number; y: number; z: number }): number {
  if (Math.abs(v.y) > 0.5) return 0;
  if (Math.abs(v.x) > 0.5) return 1;
  return 2;
}

/** 预计算 12 个转层在 (排列,朝向) 抽象空间上的迁移表。 */
export function buildTransitions(): Transition[] {
  const moves = faceMoves();
  return moves.map((m) => {
    const cubeAfter = LogicalCube.solved(ORDER);
    cubeAfter.applyMove(m.axis, m.layerIndex, m.dir);
    const ex = extract(cubeAfter);
    const newPos = new Array<number>(N_POS).fill(-1);
    for (let i = 0; i < N_POS; i++) {
      const toPos = ex.perm.indexOf(i);
      newPos[i] = toPos;
    }
    // 朝向迁移：所有被转动的角块经历同一旋转，U/D 颜色指向轴按同一置换变化。
    // 用代表向量 (+Y,+X,+Z) 经本转层旋转后取主导轴得到置换。
    const oPerm = [0, 1, 2].map((code) => {
      const vec = code === 0 ? { x: 0, y: 1, z: 0 } : code === 1 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
      return axisCode(rotateVector(vec, m.axis, m.dir));
    });
    return { newPos, oPerm };
  });
}

export function applyPerm(perm: number[], t: Transition): number[] {
  const next = new Array<number>(N_POS).fill(-1);
  for (let i = 0; i < N_POS; i++) next[t.newPos[i]] = perm[i];
  return next;
}

function applyOrient(orient: number[], t: Transition): number[] {
  const next = new Array<number>(N_POS).fill(0);
  for (let i = 0; i < N_POS; i++) {
    if (t.newPos[i] !== i) next[t.newPos[i]] = t.oPerm[orient[i]];
    else next[t.newPos[i]] = orient[i];
  }
  return next;
}

const FACT: number[] = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

export function lehmer(perm: number[]): number {
  let res = 0;
  for (let i = 0; i < N_POS; i++) {
    let smaller = 0;
    for (let j = i + 1; j < N_POS; j++) if (perm[j] < perm[i]) smaller++;
    res += smaller * FACT[N_POS - 1 - i];
  }
  return res;
}

function orientIndex(orient: number[]): number {
  let res = 0;
  for (let i = 0; i < N_POS; i++) res = res * 3 + orient[i];
  return res;
}

export function bfsPerm(trans: Transition[]): Uint8Array {
  const dist = new Uint8Array(40320).fill(255);
  const start = lehmer([0, 1, 2, 3, 4, 5, 6, 7]);
  dist[start] = 0;
  const queue: number[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist[cur];
    // 由 cur 还原排列
    const p = decodeLehmer(cur);
    for (const t of trans) {
      const np = applyPerm(p, t);
      const idx = lehmer(np);
      if (dist[idx] === 255) {
        dist[idx] = d + 1;
        queue.push(idx);
      }
    }
  }
  return dist;
}

export function bfsOrient(trans: Transition[]): Uint8Array {
  const dist = new Uint8Array(6561).fill(255);
  const start = 0;
  dist[start] = 0;
  const queue: number[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist[cur];
    const o = decodeOrient(cur);
    for (const t of trans) {
      const no = applyOrient(o, t);
      const idx = orientIndex(no);
      if (dist[idx] === 255) {
        dist[idx] = d + 1;
        queue.push(idx);
      }
    }
  }
  return dist;
}

export function decodeLehmer(code: number): number[] {
  const perm = [0, 1, 2, 3, 4, 5, 6, 7];
  const res = new Array<number>(N_POS);
  let c = code;
  for (let i = 0; i < N_POS; i++) {
    const f = FACT[N_POS - 1 - i];
    const q = Math.floor(c / f);
    c = c % f;
    res[i] = perm[q];
    perm.splice(q, 1);
  }
  return res;
}

function decodeOrient(code: number): number[] {
  const res = new Array<number>(N_POS);
  let c = code;
  for (let i = N_POS - 1; i >= 0; i--) {
    res[i] = c % 3;
    c = Math.floor(c / 3);
  }
  return res;
}

export class SolverData {
  trans: Transition[];
  permPDB: Uint8Array;
  orientPDB: Uint8Array;

  constructor() {
    this.trans = buildTransitions();
    this.permPDB = bfsPerm(this.trans);
    this.orientPDB = bfsOrient(this.trans);
  }

  heuristic(perm: number[], orient: number[]): number {
    const h = Math.max(this.permPDB[lehmer(perm)], this.orientPDB[orientIndex(orient)]);
    return h === 255 ? 0 : h;
  }
}

let data: SolverData | null = null;
function getData(): SolverData {
  if (!data) data = new SolverData();
  return data;
}

function isSolvedState(perm: number[], orient: number[]): boolean {
  for (let i = 0; i < N_POS; i++) if (perm[i] !== i || orient[i] !== 0) return false;
  return true;
}

/** IDA* 搜索。 */
function idaStar(sd: SolverData, startPerm: number[], startOrient: number[]): Move[] | null {
  const moves = faceMoves();
  let bound = sd.heuristic(startPerm, startOrient);

  const search = (
    perm: number[],
    orient: number[],
    g: number,
    bound: number,
    lastMove: number,
    path: Move[],
  ): Move[] | null => {
    const h = sd.heuristic(perm, orient);
    const f = g + h;
    if (f > bound) return null;
    if (isSolvedState(perm, orient)) return [...path];
    for (let k = 0; k < moves.length; k++) {
      // 避免与上一步做同一面/同向的逆操作造成的无谓往返。
      if (lastMove !== -1 && k !== lastMove && isInversePair(moves[lastMove], moves[k])) continue;
      const t = sd.trans[k];
      const np = applyPerm(perm, t);
      const no = applyOrient(orient, t);
      path.push(moves[k]);
      const res = search(np, no, g + 1, bound, k, path);
      if (res) return res;
      path.pop();
    }
    return null;
  };

  while (bound <= 20) {
    const path: Move[] = [];
    const res = search(startPerm, startOrient, 0, bound, -1, path);
    if (res) return res;
    bound++;
  }
  return null;
}

function isInversePair(a: Move, b: Move): boolean {
  return a.axis === b.axis && a.layerIndex === b.layerIndex && a.dir === -b.dir;
}

export class LayerSolver2 implements Solver {
  readonly supportedOrders = [2];

  solve(cube: LogicalCube): Move[] {
    const sd = getData();
    const { perm, orient } = extract(cube);
    const solution = idaStar(sd, perm, orient);
    if (!solution) {
      // 理论不会发生（2x2 必可解），兜底返回空。
      console.warn('[solver2] IDA* 未找到解，回退空解');
      return [];
    }
    return solution;
  }
}
