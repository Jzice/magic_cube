import * as THREE from 'three';
import type { ColorKey, FaceDef } from '../types';

/** 六面 + 内部颜色（与原版一致）。 */
export const COLORS: Record<ColorKey, number> = {
  right: 0xff3b30,
  left: 0xff9500,
  up: 0xffffff,
  down: 0xffcc00,
  front: 0x34c759,
  back: 0x007aff,
  inner: 0x1a1a1e,
};

/** 六个外露面的定义（轴向 / 正负 / 法线 / 颜色）。 */
export const FACE_DEFS: FaceDef[] = [
  { key: 'right', axis: 'x', sign: 1, normal: new THREE.Vector3(1, 0, 0), color: COLORS.right },
  { key: 'left', axis: 'x', sign: -1, normal: new THREE.Vector3(-1, 0, 0), color: COLORS.left },
  { key: 'up', axis: 'y', sign: 1, normal: new THREE.Vector3(0, 1, 0), color: COLORS.up },
  { key: 'down', axis: 'y', sign: -1, normal: new THREE.Vector3(0, -1, 0), color: COLORS.down },
  { key: 'front', axis: 'z', sign: 1, normal: new THREE.Vector3(0, 0, 1), color: COLORS.front },
  { key: 'back', axis: 'z', sign: -1, normal: new THREE.Vector3(0, 0, -1), color: COLORS.back },
];

/** 面键 -> 求解器用的颜色代号（标准配色：W白 U / Y黄 D / G绿 F / B蓝 B / R红 R / O橙 L）。 */
export const FACE_CODE: Record<ColorKey, string> = {
  right: 'R',
  left: 'O',
  up: 'W',
  down: 'Y',
  front: 'G',
  back: 'B',
  inner: '?',
};

/** 由面法线方向（单位向量）得到对应的面键。 */
export function faceKeyFromNormal(n: THREE.Vector3): ColorKey {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  if (ax >= ay && ax >= az) return n.x > 0 ? 'right' : 'left';
  if (ay >= az) return n.y > 0 ? 'up' : 'down';
  return n.z > 0 ? 'front' : 'back';
}

/** cubie 本体与贴纸的基础尺寸（与原版一致）。 */
export const CUBIE_SIZE = 1;
export const GAP = 0.04;
export const STEP = CUBIE_SIZE + GAP;

/** 可选阶数。 */
export const ORDER_OPTIONS = [2, 3, 4, 5];

/** 打乱步数：≤3 阶 20 步，否则 24 步（与原版一致）。 */
export function scrambleSteps(order: number): number {
  return order <= 3 ? 20 : 24;
}
