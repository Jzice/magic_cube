import type { Axis, Move } from '../types';
import type { LogicalCube, Dir } from './logicalCube';
import type { Solver } from '../types';
// 两阶段（Kociemba）求解器：cubejs 为成熟的纯 JS 实现，无原生依赖，可内联进单文件产物。
import Cube from 'cubejs';

/** 剪枝表只需初始化一次；首次求解（或空闲预热）时惰性执行。 */
let solverReady = false;
function ensureSolver(): void {
  if (solverReady) return;
  Cube.initSolver();
  solverReady = true;
}

/** 供 main.ts 在空闲时预热，避免首次点击「自动还原」时的同步初始化卡顿。 */
export function warmupSolver3(): void {
  ensureSolver();
}

/** 对 54 字符面片串求解，返回标准记号串；异常 / 无解返回 null。2 阶求解器也复用此入口。 */
export function solveFacelets(facelets: string): string | null {
  try {
    ensureSolver();
    const result = Cube.fromString(facelets).solve();
    return result || null;
  } catch (err) {
    console.warn('[solver3] 求解失败', err);
    return null;
  }
}

/** 我们的面颜色代号 -> Kociemba 面字母（U/R/F/D/L/B，仅作身份标识）。 */
const COLOR_TO_LETTER: Record<string, string> = {
  R: 'R', O: 'L', W: 'U', Y: 'D', G: 'F', B: 'B',
};

interface FaceRead {
  normal: Dir;
  /** 由 (row,col) 得到该读取位对应的网格坐标（N=3，标准 facecube 阅读顺序）。 */
  at: (row: number, col: number) => { x: number; y: number; z: number };
}

const R = (x: number, y: number, z: number) => ({ x, y, z });

/**
 * 六个面的读取方式，顺序为 Kociemba 约定的 U,R,F,D,L,B。
 * 每个面按标准 facecube 阅读顺序（左上→右下，与 kociemba C 实现一致）。
 */
function faceReads(): { read: FaceRead }[] {
  return [
    { read: { normal: { x: 0, y: 1, z: 0 }, at: (r, c) => R(c, 2, r) } },             // U (+Y)
    { read: { normal: { x: 1, y: 0, z: 0 }, at: (r, c) => R(2, 2 - r, 2 - c) } },     // R (+X)
    { read: { normal: { x: 0, y: 0, z: 1 }, at: (r, c) => R(c, 2 - r, 2) } },         // F (+Z)
    { read: { normal: { x: 0, y: -1, z: 0 }, at: (r, c) => R(c, 0, 2 - r) } },        // D (-Y)
    { read: { normal: { x: -1, y: 0, z: 0 }, at: (r, c) => R(0, 2 - r, c) } },        // L (-X)
    { read: { normal: { x: 0, y: 0, z: -1 }, at: (r, c) => R(2 - c, 2 - r, 0) } },    // B (-Z)
  ];
}

/** 由逻辑魔方构造 Kociemba 需要的 54 字符状态串（顺序 U,R,F,D,L,B）。 */
export function buildStateString(cube: LogicalCube): string {
  const reads = faceReads();
  let out = '';
  for (const { read } of reads) {
    for (let r = 0; r < cube.order; r++) {
      for (let c = 0; c < cube.order; c++) {
        const p = read.at(r, c);
        const piece = cube.pieces.find((pc) => pc.pos.x === p.x && pc.pos.y === p.y && pc.pos.z === p.z);
        if (!piece) {
          out += '?';
          continue;
        }
        let color = '?';
        for (const [code, v] of piece.normals) {
          if (cube.eqDir(v, read.normal)) {
            color = COLOR_TO_LETTER[code] ?? '?';
            break;
          }
        }
        out += color;
      }
    }
  }
  return out;
}

/** 单层面的 (axis, 外层序号, dir)：方向需与 kociemba 的记法约定一致（U/D/R/L 与 F/B 符号相反）。 */
function faceInfo(upper: string, order: number): { axis: Axis; layerIndex: number; baseDir: 1 | -1 } {
  switch (upper) {
    case 'F': return { axis: 'z', layerIndex: order - 1, baseDir: -1 };
    case 'B': return { axis: 'z', layerIndex: 0, baseDir: 1 };
    case 'U': return { axis: 'y', layerIndex: order - 1, baseDir: -1 };
    case 'D': return { axis: 'y', layerIndex: 0, baseDir: 1 };
    case 'R': return { axis: 'x', layerIndex: order - 1, baseDir: -1 };
    case 'L': return { axis: 'x', layerIndex: 0, baseDir: 1 };
    default: throw new Error('bad face');
  }
}

/** 将 Kociemba 的一个记号 token（U / U' / U2）映射为本模型的 (axis, layerIndex, dir)。 */
export function tokenToMoves(token: string, order: number): Move[] {
  const m = /^([RLUDFB])(['2]?)$/.exec(token);
  if (!m) return [];
  const face = m[1];
  const mod = m[2];
  const fi = faceInfo(face, order);
  const dir: 1 | -1 = mod === "'" ? (-fi.baseDir as 1 | -1) : fi.baseDir;
  const moves = [{ axis: fi.axis, layerIndex: fi.layerIndex, dir }];
  if (mod === '2') return [moves[0], { ...moves[0] }];
  return moves;
}

/** 3 阶求解器：Kociemba 两阶段算法，结果映射回本模型动作。 */
export class LayerSolver3 implements Solver {
  readonly supportedOrders = [3];

  solve(cube: LogicalCube): Move[] | null {
    const result = solveFacelets(buildStateString(cube));
    if (!result) return null;

    const tokens = result.trim().split(/\s+/).filter(Boolean);
    const moves: Move[] = [];
    for (const tok of tokens) {
      const mapped = tokenToMoves(tok, cube.order);
      if (mapped.length === 0) return null;
      moves.push(...mapped);
    }
    return moves.length > 0 ? moves : null;
  }
}
