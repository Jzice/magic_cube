import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Cubie } from '../types';
import { state } from './state';
import { syncGround } from './scene';
import { CUBIE_SIZE, FACE_DEFS, STEP, faceKeyFromNormal } from '../config/cubeConfig';

/** 由整数网格坐标生成唯一键。 */
export function gridKey(v: THREE.Vector3): string {
  return `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;
}

/** 重建指定阶数的魔方（销毁旧 cubie、重置历史），并写入 state。 */
export function buildCube(order: number): void {
  if (state.pivotGroup) {
    state.scene!.remove(state.pivotGroup);
    state.pivotGroup = null;
  }
  state.cubies.forEach((c) => {
    state.scene!.remove(c.group);
    c.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    });
  });
  state.cubies = [];
  state.cubieMap.clear();
  state.moveHistory = [];
  state.notationHistory = [];
  state.isBusy = false;
  state.operationLocked = false;
  state.animState = null;

  state.ORDER = order;
  const offset = (order - 1) / 2;

  const cubieGeo = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 4, 0.1);
  const stickerGeo = new RoundedBoxGeometry(CUBIE_SIZE * 0.82, CUBIE_SIZE * 0.82, 0.04, 4, 0.04);

  const stickerMatCache: Record<string, THREE.MeshPhysicalMaterial> = {};
  for (const f of FACE_DEFS) {
    stickerMatCache[f.key] = new THREE.MeshPhysicalMaterial({
      color: f.color,
      roughness: 0.28,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
      emissive: new THREE.Color(f.color).multiplyScalar(0.08),
    });
  }
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1e, roughness: 0.55, metalness: 0.1, clearcoat: 0.3 });

  for (let ix = 0; ix < order; ix++) {
    for (let iy = 0; iy < order; iy++) {
      for (let iz = 0; iz < order; iz++) {
        const grid = new THREE.Vector3(ix, iy, iz);
        const group = new THREE.Group();
        group.position.set((ix - offset) * STEP, (iy - offset) * STEP, (iz - offset) * STEP);

        const body = new THREE.Mesh(cubieGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const stickers: Cubie['stickers'] = {};
        for (const f of FACE_DEFS) {
          const isOuter =
            (f.axis === 'x' && ((f.sign === 1 && ix === order - 1) || (f.sign === -1 && ix === 0))) ||
            (f.axis === 'y' && ((f.sign === 1 && iy === order - 1) || (f.sign === -1 && iy === 0))) ||
            (f.axis === 'z' && ((f.sign === 1 && iz === order - 1) || (f.sign === -1 && iz === 0)));
          if (!isOuter) continue;

          const sticker = new THREE.Mesh(stickerGeo, stickerMatCache[f.key]);
          const n = f.normal;
          const d = CUBIE_SIZE / 2 + 0.021;
          sticker.position.set(n.x * d, n.y * d, n.z * d);
          const q = new THREE.Quaternion();
          q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
          sticker.quaternion.copy(q);
          sticker.userData.normal = n.clone();
          group.add(sticker);
          stickers[f.key] = sticker;
        }

        const cubie: Cubie = {
          group,
          stickers,
          grid: grid.clone(),
          orientation: new THREE.Matrix4(),
        };
        Object.values(stickers).forEach((s) => {
          s.userData.cubie = cubie;
        });

        state.cubies.push(cubie);
        state.cubieMap.set(gridKey(grid), cubie);
        state.scene!.add(group);
      }
    }
  }

  syncGround();
}

const tmpNormal = new THREE.Vector3();

/**
 * 判定魔方是否已还原：每张贴纸都指向它原本所属的面。
 *
 * 不能用「orientation 是否为单位矩阵」判定：中心块只有一张贴纸，绕自身法线的旋转
 * 在视觉上完全不可见，但会改变矩阵；求解器给出的解法与打乱序列不同，合法地还原后
 * 中心块常残留这种自转。此处与 LogicalCube.isSolved() 采用同一套「按面判定」口径。
 */
export function isSolved(): boolean {
  for (const c of state.cubies) {
    for (const [key, mesh] of Object.entries(c.stickers)) {
      if (!mesh) continue;
      tmpNormal.copy(mesh.userData.normal as THREE.Vector3).applyMatrix4(c.orientation);
      if (faceKeyFromNormal(tmpNormal) !== key) return false;
    }
  }
  return true;
}
