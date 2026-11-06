import type * as THREE from 'three';

/** 三个坐标轴。 */
export type Axis = 'x' | 'y' | 'z';

/** 六个面（含内部）的键名。 */
export type ColorKey = 'right' | 'left' | 'up' | 'down' | 'front' | 'back' | 'inner';

/** 面的定义：轴向、正负、法线、颜色。 */
export interface FaceDef {
  key: ColorKey;
  axis: Axis;
  sign: 1 | -1;
  normal: THREE.Vector3;
  color: number;
}

/** 一个 cubie（小方块）的运行时数据。 */
export interface Cubie {
  group: THREE.Group;
  /** 各外露面的贴纸网格，键为面名。 */
  stickers: Partial<Record<ColorKey, THREE.Mesh>>;
  /** 整数网格坐标（随转动更新）。 */
  grid: THREE.Vector3;
  /** 朝向矩阵（纯旋转），用于判定已还原与抽取逻辑状态。 */
  orientation: THREE.Matrix4;
}

/** 一次转层：轴、层序号、方向（±1）。 */
export interface Move {
  axis: Axis;
  layerIndex: number;
  dir: 1 | -1;
}

/** 动画状态。 */
export interface AnimState {
  pivotGroup: THREE.Group;
  axisVec: THREE.Vector3;
  targetAngle: number;
  duration: number;
  startTime: number;
  resolve: () => void;
  layerCubies: Cubie[];
}

/** 求解器接口：输入逻辑魔方状态，输出可直接执行的 Move 序列；无解 / 状态非法时返回 null。 */
export interface Solver {
  readonly supportedOrders: number[];
  solve(cube: import('../solver/logicalCube').LogicalCube): Move[] | null;
}
