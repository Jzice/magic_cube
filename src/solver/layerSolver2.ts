import type { Move, Solver } from '../types';
import { LogicalCube, type Dir, type Piece } from './logicalCube';
import { buildStateString, solveFacelets, tokenToMoves } from './layerSolver3';
import { validateFacelets } from './validate';

/**
 * 2 阶求解器。
 *
 * 2×2 只有 8 个角块，原先的 IDA* + 双 PDB 在浅层打乱下很快，但对任意深度的随机状态
 * 缺乏足够剪枝，实测会出现数秒仍搜不到解的情况，无法满足「任意打乱都能还原」。
 * 这里改为复用 3 阶的两阶段求解器：把 2 阶角块状态嵌入一个**合法的 3×3 状态**
 * （棱块按角排列奇偶决定是否交换一对，使整体奇偶合法），求出解法后把面转层号
 * 从 3 阶的 0/2 映射为 2 阶的 0/1。3×3 的棱/中心在 2×2 上不存在，不影响结果。
 *
 * 该做法对任意合法 2 阶状态都能给出解，且单次求解与 3 阶同量级（毫秒级）。
 */

/** 把 2 阶角块（坐标 0/1）映射到 3 阶角块坐标（0/2），其余块保持还原态。 */
function embedCorners(cube: LogicalCube): LogicalCube | null {
  const synthetic = LogicalCube.solved(3);
  for (const piece of cube.pieces) {
    const target = synthetic.pieces.find(
      (p) => p.pos.x === piece.pos.x * 2 && p.pos.y === piece.pos.y * 2 && p.pos.z === piece.pos.z * 2,
    );
    if (!target) return null;
    target.normals = new Map([...piece.normals].map(([color, dir]) => [color, { ...dir }]));
  }
  return synthetic;
}

/** 给 U 层某条棱指定颜色组合，保持棱朝向 eo=0。 */
function setUEdge(piece: Piece, colors: string[], sideDir: Dir): void {
  const ud = colors.find((c) => c === 'W' || c === 'Y');
  const side = colors.find((c) => c !== ud);
  if (!ud || !side) return;
  piece.normals = new Map<string, Dir>([
    [ud, { x: 0, y: 1, z: 0 }],
    [side, sideDir],
  ]);
}

/**
 * 交换 UF / UR 两条棱（保持棱朝向），使 3×3 状态的棱排列奇偶翻转。
 * 2 阶角排列可以是奇排列，此时需要奇排列的棱才能构成合法的 3×3 状态。
 */
function swapTwoEdges(synthetic: LogicalCube): void {
  const uf = synthetic.pieces.find((p) => p.pos.x === 1 && p.pos.y === 2 && p.pos.z === 2);
  const ur = synthetic.pieces.find((p) => p.pos.x === 2 && p.pos.y === 2 && p.pos.z === 1);
  if (!uf || !ur) return;
  const ufColors = [...uf.normals.keys()];
  const urColors = [...ur.normals.keys()];
  setUEdge(uf, urColors, { x: 0, y: 0, z: 1 });
  setUEdge(ur, ufColors, { x: 1, y: 0, z: 0 });
}

/** 生成两个候选中唯一合法（角/棱奇偶一致、朝向和合法）的 3×3 状态串。 */
function legalFacelets(cube: LogicalCube): string | null {
  for (const swapEdges of [false, true]) {
    const synthetic = embedCorners(cube);
    if (!synthetic) return null;
    if (swapEdges) swapTwoEdges(synthetic);
    const state = buildStateString(synthetic);
    if (validateFacelets(state).ok) return state;
  }
  return null;
}

export class LayerSolver2 implements Solver {
  readonly supportedOrders = [2];

  solve(cube: LogicalCube): Move[] | null {
    const state = legalFacelets(cube);
    if (!state) return null;

    const result = solveFacelets(state);
    if (!result) return null;

    const moves: Move[] = [];
    for (const token of result.trim().split(/\s+/).filter(Boolean)) {
      const mapped = tokenToMoves(token, 3);
      if (mapped.length === 0) return null;
      for (const m of mapped) {
        // 3 阶外层 2 -> 2 阶外层 1；0 保持不变；转层方向完全一致。
        moves.push({ axis: m.axis, layerIndex: m.layerIndex === 2 ? 1 : 0, dir: m.dir });
      }
    }
    return moves.length > 0 ? moves : null;
  }
}
