import type { Axis } from '../types';

/**
 * 整数网格坐标随一次 ±90° 转层后的新坐标（与原版 performMove 中用于更新 grid 的 rotateGrid 完全一致）。
 * 约定：grid 坐标为 0..N-1，绕魔方中心（= (N-1)/2）旋转。
 */
export function rotateGrid(grid: { x: number; y: number; z: number }, axis: Axis, dir: 1 | -1, N: number): { x: number; y: number; z: number } {
  const { x, y, z } = grid;
  const max = N - 1;
  if (axis === 'x') return dir > 0 ? { x, y: max - z, z: y } : { x, y: z, z: max - y };
  if (axis === 'y') return dir > 0 ? { x: z, y, z: max - x } : { x: max - z, y, z: x };
  return dir > 0 ? { x: max - y, y: x, z } : { x: y, y: max - x, z };
}

/**
 * 方向向量随一次 ±90° 绕 +axis 旋转后的新向量（右手定则，配合 THREE 的 makeRotationAxis(axisVec, dir·π/2)）。
 * 与 rotateGrid 基于同一旋转线性部分，因此 3D 表现与逻辑求解完全一致。
 */
export function rotateVector(v: { x: number; y: number; z: number }, axis: Axis, dir: 1 | -1): { x: number; y: number; z: number } {
  const { x, y, z } = v;
  if (axis === 'x') return dir > 0 ? { x, y: -z, z: y } : { x, y: z, z: -y };
  if (axis === 'y') return dir > 0 ? { x: z, y, z: -x } : { x: -z, y, z: x };
  return dir > 0 ? { x: -y, y: x, z } : { x: y, y: -x, z };
}

/** 将任意向量规整到最近的坐标轴单位向量（容差内）。 */
export function snapToAxis(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  if (ax >= ay && ax >= az) return { x: Math.sign(v.x), y: 0, z: 0 };
  if (ay >= az) return { x: 0, y: Math.sign(v.y), z: 0 };
  return { x: 0, y: 0, z: Math.sign(v.z) };
}
