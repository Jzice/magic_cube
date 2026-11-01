import type { Cubie } from '../types';
import { LogicalCube } from './logicalCube';

/** 从 3D cubies 抽取当前逻辑状态，供求解器使用。 */
export function buildLogicalFromCubies(order: number, cubies: Cubie[]): LogicalCube {
  return LogicalCube.fromCubies(order, cubies);
}
