import type { Axis, Move } from '../types';
import type { LogicalCube, Piece } from './logicalCube';
import { FACE_CENTER_COLOR, FACE_DIR } from './logicalCube';

/**
 * 3 阶中心归位。
 *
 * 中层转动（M/E/S）会让四个侧面中心块换位，而标准 Kociemba 求解器假定中心固定，
 * 并且外层动作无法移动中心块，因此这类状态不能直接求解。
 * 但中层动作可分解为「外层动作 + 魔方整体旋转」，整体旋转共轭外层动作仍是外层动作，
 * 于是任意由本引擎操作产生的状态都可写成「外层动作序列 + 一个整体旋转」。
 * 先用整体旋转把六个中心块送回标准方位，剩下的就是一个普通 3×3 状态。
 *
 * 这里用 BFS 枚举 24 种立方体朝向（生成器为三个轴上的 ±90° 整体旋转），找出最短的
 * 整体旋转序列；每个整体旋转展开为「同一轴所有层同向转动」的逐层动作。
 * 正确性由上层「归位后合法性校验 + 完整解法干跑」双重保证，不手写旋转映射表。
 */

const CENTER_FACES = ['U', 'D', 'R', 'L', 'F', 'B'] as const;
const AXES: Axis[] = ['x', 'y', 'z'];
const DIRS: (1 | -1)[] = [1, -1];

/** 取某个面中心位置的 cubie；3 阶该位置恰好只有一个贴纸。 */
function centerPiece(cube: LogicalCube, face: string): Piece | null {
  const dir = FACE_DIR[face];
  const c = (cube.order - 1) / 2;
  const pos = {
    x: c + dir.x * c,
    y: c + dir.y * c,
    z: c + dir.z * c,
  };
  return cube.pieces.find((p) => p.pos.x === pos.x && p.pos.y === pos.y && p.pos.z === pos.z) ?? null;
}

/** 某面中心位置上朝该面外法线的贴纸颜色；找不到时返回 '?'。 */
function centerColor(cube: LogicalCube, face: string): string {
  const piece = centerPiece(cube, face);
  if (!piece) return '?';
  const dir = FACE_DIR[face];
  for (const [code, v] of piece.normals) {
    if (cube.eqDir(v, dir)) return code;
  }
  return '?';
}

/** 判断 3 阶六个中心块是否都已处于标准方位（其它阶数无单一中心块，直接视为已归位）。 */
export function centersSolved(cube: LogicalCube): boolean {
  if (cube.order !== 3) return true;
  return CENTER_FACES.every((face) => centerColor(cube, face) === FACE_CENTER_COLOR[face]);
}

/** 以六个面的中心颜色作为朝向标识：六个颜色互不相同，故 24 种朝向一一对应。 */
function centerKey(cube: LogicalCube): string {
  return CENTER_FACES.map((face) => centerColor(cube, face)).join('');
}

/** 六个整体旋转生成器：绕 x/y/z 轴各 ±90°，每次展开为逐层同向转动。 */
function wholeRotations(order: number): Move[][] {
  const rotations: Move[][] = [];
  for (const axis of AXES) {
    for (const dir of DIRS) {
      const moves: Move[] = [];
      for (let layerIndex = 0; layerIndex < order; layerIndex++) {
        moves.push({ axis, layerIndex, dir });
      }
      rotations.push(moves);
    }
  }
  return rotations;
}

interface FrameNode {
  cube: LogicalCube;
  prefix: Move[];
}

/**
 * 用整体旋转把中心块归位。
 * 返回归位后的逻辑状态与需前置执行的动作序列；中心已归位时返回 `prefix: []`；
 * 无法归位（状态结构异常）时返回 `null`。
 */
export function normalizeCenters(cube: LogicalCube): { cube: LogicalCube; prefix: Move[] } | null {
  const start = cube.clone();
  if (cube.order !== 3 || centersSolved(start)) return { cube: start, prefix: [] };

  const rotations = wholeRotations(cube.order);
  const queue: FrameNode[] = [{ cube: start, prefix: [] }];
  const visited = new Set<string>([centerKey(start)]);
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    if (centersSolved(node.cube)) return { cube: node.cube, prefix: node.prefix };
    for (const rotation of rotations) {
      const next = node.cube.clone();
      for (const m of rotation) next.applyMove(m.axis, m.layerIndex, m.dir);
      const key = centerKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ cube: next, prefix: [...node.prefix, ...rotation] });
    }
  }
  return null;
}
