import type { Dir, LogicalCube, Piece } from './logicalCube';
import { FACE_CENTER_COLOR, FACE_DIR, LogicalCube as Cube } from './logicalCube';

/**
 * 魔方状态合法性校验。
 *
 * 用于区分「结构合法但被打乱」与「手工改色 / 镜像块 / 奇偶错误」等物理上不可能的状态：
 * 合法状态照常求解，非法状态给出明确原因而不是误报「还原完成」。
 * 3 阶中层转动会让中心块换位，虽不满足标准 3×3 面片校验，但仍属合法结构状态，
 * 由 `centerFrame` 先做整体旋转归位再求解，不再视为不可还原。
 */

export type Validation = { ok: true } | { ok: false; reason: string };

const FACE_OF_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(FACE_CENTER_COLOR).map(([face, color]) => [color, face]),
);

/** 颜色代号在还原态下所指的外法线方向。 */
const SOLVED_DIR: Record<string, Dir> = Object.fromEntries(
  Object.entries(FACE_OF_COLOR).map(([color, face]) => [color, FACE_DIR[face]]),
);

// ===== Kociemba 标准面片位置表（U,R,F,D,L,B 顺序，每面 9 格，索引 0..53） =====
const CORNER_FACELET: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const CORNER_COLOR: string[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
const EDGE_FACELET: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46],
  [32, 16], [28, 25], [30, 43], [34, 52],
  [23, 12], [21, 41], [50, 39], [48, 14],
];
const EDGE_COLOR: string[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'],
  ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'],
  ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

function fail(reason: string): Validation {
  return { ok: false, reason };
}

function dot(a: Dir, b: Dir): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** 以 a,b,c 为列的行列式（用于判断三贴纸角块是否为镜像，镜像不可能由转动得到）。 */
function triple(a: Dir, b: Dir, c: Dir): number {
  return dot(a, {
    x: b.y * c.z - b.z * c.y,
    y: b.z * c.x - b.x * c.z,
    z: b.x * c.y - b.y * c.x,
  });
}

function dirKey(d: Dir): string {
  return `${Math.round(d.x)},${Math.round(d.y)},${Math.round(d.z)}`;
}

function isUnitAxis(d: Dir): boolean {
  return Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.z)
    && Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z) === 1;
}

/** 某个网格位置有几个外露面，以及各外露面的法线。 */
function outerDirs(pos: Piece['pos'], order: number): Dir[] {
  const out: Dir[] = [];
  if (pos.x === 0) out.push({ x: -1, y: 0, z: 0 });
  else if (pos.x === order - 1) out.push({ x: 1, y: 0, z: 0 });
  if (pos.y === 0) out.push({ x: 0, y: -1, z: 0 });
  else if (pos.y === order - 1) out.push({ x: 0, y: 1, z: 0 });
  if (pos.z === 0) out.push({ x: 0, y: 0, z: -1 });
  else if (pos.z === order - 1) out.push({ x: 0, y: 0, z: 1 });
  return out;
}

function colorKey(colors: string[]): string {
  return [...colors].sort().join(',');
}

function keyCounts(pieces: Piece[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of pieces) {
    const key = colorKey([...p.normals.keys()]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * 通用结构校验（适用于 2–5 阶）：
 * - 网格位置完整且不重复；
 * - 每个 cubie 的贴纸数 == 该位置的外露面数，且贴纸方向恰好指向这些外露面；
 * - 每色贴纸总数 == order²；
 * - 所有 cubie 的颜色组合多重集与还原态一致（拦截改色 / 换块 / 丢块）；
 * - 每个 cubie 的「颜色 -> 方向」映射是还原态的**真旋转**（拦截镜像等不可能状态）。
 */
export function validateLogical(cube: LogicalCube): Validation {
  const order = cube.order;
  if (!Number.isInteger(order) || order < 2) return fail(`阶数不合法：${order}`);
  if (cube.pieces.length !== order ** 3) return fail('魔方块数量与阶数不符');

  const seenPos = new Set<string>();
  const colorCounts = new Map<string, number>();
  for (const p of cube.pieces) {
    const { x, y, z } = p.pos;
    const pk = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (seenPos.has(pk)) return fail('存在重复的网格位置');
    seenPos.add(pk);
    if ([x, y, z].some((v) => !Number.isInteger(v) || v < 0 || v >= order)) {
      return fail('存在越界的网格位置');
    }

    const colors = [...p.normals.keys()];
    const dirs = colors.map((c) => p.normals.get(c)!);
    const expected = outerDirs(p.pos, order);
    if (colors.length !== expected.length) return fail('贴纸数量与所在位置不符（状态不合法）');
    if (colors.some((c) => !SOLVED_DIR[c])) return fail('存在未知颜色贴纸（状态不合法）');
    if (dirs.some((d) => !isUnitAxis(d))) return fail('存在非法贴纸朝向（状态不合法）');
    const expectedKeys = new Set(expected.map(dirKey));
    if (dirs.some((d) => !expectedKeys.has(dirKey(d))) || new Set(dirs.map(dirKey)).size !== dirs.length) {
      return fail('贴纸朝向与所在位置不符（状态不合法）');
    }
    for (const c of colors) colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);

    // 真旋转校验：保持两两夹角；三个贴纸时还要求手性一致（排除镜像）。
    const solvedDirs = colors.map((c) => SOLVED_DIR[c]);
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        if (dot(solvedDirs[i], solvedDirs[j]) !== dot(dirs[i], dirs[j])) {
          return fail('存在物理上不可能的块朝向（状态不合法）');
        }
      }
    }
    if (colors.length === 3 && Math.sign(triple(solvedDirs[0], solvedDirs[1], solvedDirs[2]))
      !== Math.sign(triple(dirs[0], dirs[1], dirs[2]))) {
      return fail('存在镜像角块（状态不合法）');
    }
  }

  for (const color of Object.keys(SOLVED_DIR)) {
    if ((colorCounts.get(color) ?? 0) !== order * order) {
      return fail('各颜色贴纸数量不相等（状态不合法）');
    }
  }

  const actual = keyCounts(cube.pieces);
  const solved = keyCounts(Cube.solved(order).pieces);
  if (actual.size !== solved.size) return fail('魔方块组成与还原态不一致（状态不合法）');
  for (const [key, count] of solved) {
    if (actual.get(key) !== count) return fail('魔方块组成与还原态不一致（状态不合法）');
  }
  return { ok: true };
}

function permutationParity(perm: number[]): number {
  let swaps = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) if (perm[j] < perm[i]) swaps++;
  }
  return swaps % 2;
}

/**
 * 3 阶标准的 Kociemba 状态校验：中心固定、角/棱块各出现一次、
 * 角朝向和 %3==0、棱翻转和 %2==0、角棱排列奇偶一致。
 * 这保证后续两阶段求解器一定不会在非法状态上空转。
 */
export function validateFacelets(state: string): Validation {
  if (state.length !== 54 || /[^URFDLB]/.test(state)) return fail('面片状态串不合法');

  const centers = ['U', 'R', 'F', 'D', 'L', 'B'];
  for (let i = 0; i < 6; i++) {
    if (state[9 * i + 4] !== centers[i]) {
      return fail('3 阶中心块错位（可能转动了中层或导入了外部状态），标准 3×3 求解器不能直接还原，需先归位中心');
    }
  }

  const cp = new Array<number>(8).fill(-1);
  let twistSum = 0;
  for (let i = 0; i < 8; i++) {
    let ori = -1;
    for (let o = 0; o < 3; o++) {
      const ch = state[CORNER_FACELET[i][o]];
      if (ch === 'U' || ch === 'D') { ori = o; break; }
    }
    if (ori < 0) return fail('存在不合法的角块颜色组合');
    const c1 = state[CORNER_FACELET[i][(ori + 1) % 3]];
    const c2 = state[CORNER_FACELET[i][(ori + 2) % 3]];
    const found = CORNER_COLOR.findIndex((c) => c[1] === c1 && c[2] === c2);
    if (found < 0 || cp.includes(found)) return fail('角块重复或颜色组合不合法');
    cp[i] = found;
    twistSum += ori;
  }
  if (twistSum % 3 !== 0) return fail('角块朝向和不合法（状态不可解）');

  const ep = new Array<number>(12).fill(-1);
  let flipSum = 0;
  for (let i = 0; i < 12; i++) {
    const c1 = state[EDGE_FACELET[i][0]];
    const c2 = state[EDGE_FACELET[i][1]];
    for (let j = 0; j < 12; j++) {
      const ec = EDGE_COLOR[j];
      if (c1 === ec[0] && c2 === ec[1]) { ep[i] = j; break; }
      if (c1 === ec[1] && c2 === ec[0]) { ep[i] = j; flipSum++; break; }
    }
    if (ep[i] < 0) return fail('存在不合法的棱块颜色组合');
  }
  if (new Set(ep).size !== 12) return fail('棱块重复（状态不可解）');
  if (flipSum % 2 !== 0) return fail('棱块翻转和不合法（状态不可解）');
  if (permutationParity(cp) !== permutationParity(ep)) return fail('角/棱排列奇偶性不一致（状态不可解）');

  return { ok: true };
}
