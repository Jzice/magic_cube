import type { Axis, Move } from '../types';
import type { LogicalCube, Dir } from './logicalCube';
import type { Solver } from '../types';
import rubiksCubeSolver from 'rubiks-cube-solver';

/** 颜色代号 -> 求解库用的面中颜色字母（f/r/u/d/l/b）。 */
const COLOR_TO_LETTER: Record<string, string> = {
  G: 'f', W: 'u', R: 'r', Y: 'd', O: 'l', B: 'b',
};

interface FaceRead {
  normal: Dir;
  /** 由 (row,col) 得到该读取位对应的网格坐标（N=3）。 */
  at: (row: number, col: number) => { x: number; y: number; z: number };
}

/** 六个 face 的读取方式（order 固定为 3），保证一致展开即可。 */
function faceReads(): { read: FaceRead }[] {
  const R = (x: number, y: number, z: number): { x: number; y: number; z: number } => ({ x, y, z });
  return [
    { read: { normal: { x: 0, y: 0, z: 1 }, at: (r, c) => R(c, 2 - r, 2) } },
    { read: { normal: { x: 1, y: 0, z: 0 }, at: (r, c) => R(2, 2 - r, 2 - c) } },
    { read: { normal: { x: 0, y: 1, z: 0 }, at: (r, c) => R(c, 2, r) } },
    { read: { normal: { x: 0, y: -1, z: 0 }, at: (r, c) => R(c, 0, 2 - r) } },
    { read: { normal: { x: -1, y: 0, z: 0 }, at: (r, c) => R(0, 2 - r, c) } },
    { read: { normal: { x: 0, y: 0, z: -1 }, at: (r, c) => R(2 - c, 2 - r, 0) } },
  ];
}

/** 由逻辑魔方构造求解库需要的 54 字符状态串。 */
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

/** 标准单层面的 (axis, 外层序号, baseDir)。 */
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

/** 将求解库的一个记号 token 映射为本模型的 (axis, layerIndex, dir) 序列（含 3 阶内层切片）。 */
export function tokenToMoves(token: string, order: number): Move[] {
  const m = /^([RLUDFBrludfbMES])(prime|2)?$/.exec(token);
  if (!m) return [];
  const face = m[1];
  const mod = m[2] ?? '';
  const upper = face.toUpperCase();
  const isUpper = face === upper;
  const isMiddle = upper === 'M' || upper === 'E' || upper === 'S';

  let moves: Move[];

  if (isMiddle) {
    const axis: Axis = upper === 'M' ? 'x' : upper === 'E' ? 'y' : 'z';
    // 库约定：M 跟随 L(+X)、E 跟随 D(+Y)、S 跟随 F(+Z)。
    // 按所跟随面的 baseDir 决定方向：L/D 为 +1，F 为 -1。
    const baseDir: 1 | -1 = upper === 'S' ? -1 : 1;
    const dir: 1 | -1 = mod === 'prime' ? (-baseDir as 1 | -1) : baseDir;
    moves = [{ axis, layerIndex: 1, dir }];
  } else if (!isUpper) {
    // 宽移：外层 + 相邻内层切片，二者同向（经验证：与本模型等价）
    const fi = faceInfo(upper, order);
    const dir: 1 | -1 = mod === 'prime' ? (-fi.baseDir as 1 | -1) : fi.baseDir;
    const innerLayer = fi.layerIndex === order - 1 ? order - 2 : 1;
    moves = [
      { axis: fi.axis, layerIndex: fi.layerIndex, dir },
      { axis: fi.axis, layerIndex: innerLayer, dir },
    ];
  } else {
    const fi = faceInfo(upper, order);
    const dir: 1 | -1 = mod === 'prime' ? (-fi.baseDir as 1 | -1) : fi.baseDir;
    moves = [{ axis: fi.axis, layerIndex: fi.layerIndex, dir }];
  }

  if (mod === '2') return [...moves.map((mv) => ({ ...mv })), ...moves.map((mv) => ({ ...mv }))];
  return moves;
}

/** 3 阶层先法（CFOP）求解器：借助 rubiks-cube-solver 计算，再映射回本模型动作。 */
export class LayerSolver3 implements Solver {
  readonly supportedOrders = [3];

  solve(cube: LogicalCube): Move[] {
    const state = buildStateString(cube);
    const result = rubiksCubeSolver(state) as string;
    const tokens = result.trim().split(/\s+/).filter(Boolean);
    const moves: Move[] = [];
    for (const tok of tokens) {
      if (/^\[|\]$/.test(tok)) continue;
      moves.push(...tokenToMoves(tok, cube.order));
    }
    return moves;
  }
}
