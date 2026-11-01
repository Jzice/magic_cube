import * as THREE from 'three';
import type { Axis } from '../types';
import { state } from '../core/state';
import { performMove } from '../core/moveEngine';

// 复用模块级临时对象，避免每帧分配
const camDir = new THREE.Vector3();
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const dragWorld = new THREE.Vector3();
const proj = new THREE.Vector3();
const axisVec = new THREE.Vector3();

function updatePointer(e: PointerEvent): void {
  const rect = state.renderer!.domElement.getBoundingClientRect();
  state.pointer!.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer!.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickSticker(): THREE.Mesh | null {
  state.raycaster!.setFromCamera(state.pointer!, state.camera!);
  const allStickers: THREE.Mesh[] = [];
  state.cubies.forEach((c) => Object.values(c.stickers).forEach((s) => { if (s) allStickers.push(s); }));
  const hits = state.raycaster!.intersectObjects(allStickers, false);
  return hits.length === 0 ? null : (hits[0].object as THREE.Mesh);
}

/** 指针按下：命中贴纸则进入“拖拽转层”预备，否则交给 OrbitControls 旋转视角。 */
export function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0 || state.isBusy) return;
  updatePointer(e);
  const sticker = pickSticker();

  if (sticker) {
    const ds = state.dragState;
    ds.active = true;
    ds.started = false;
    ds.cubie = sticker.userData.cubie as (typeof state.cubies)[number] | null;
    ds.faceNormal = (sticker.userData.normal as THREE.Vector3).clone();
    ds.startX = e.clientX;
    ds.startY = e.clientY;
    if (state.controls) state.controls.enabled = false;
    e.preventDefault();
  } else if (state.controls) {
    state.controls.enabled = true;
  }
}

/** 指针移动：超过阈值后由拖拽方向推算转层轴并触发一次转层。 */
export function onPointerMove(e: PointerEvent): void {
  const ds = state.dragState;
  if (!ds.active || ds.started || state.isBusy) return;
  const dx = e.clientX - ds.startX;
  const dy = e.clientY - ds.startY;
  if (Math.hypot(dx, dy) < 14) return;

  ds.started = true;
  state.camera!.getWorldDirection(camDir);
  camRight.crossVectors(camDir, state.camera!.up).normalize();
  camUp.crossVectors(camRight, camDir).normalize();

  dragWorld.addScaledVector(camRight, dx).addScaledVector(camUp, -dy).normalize();
  const n = ds.faceNormal!;
  proj.copy(dragWorld).sub(n.clone().multiplyScalar(dragWorld.dot(n)));

  if (proj.lengthSq() < 1e-6) {
    ds.active = false;
    if (state.controls) state.controls.enabled = true;
    return;
  }
  proj.normalize();

  axisVec.crossVectors(n, proj).normalize();
  const absX = Math.abs(axisVec.x);
  const absY = Math.abs(axisVec.y);
  const absZ = Math.abs(axisVec.z);
  let axis: Axis;
  let sign: number;
  if (absX >= absY && absX >= absZ) { axis = 'x'; sign = Math.sign(axisVec.x); }
  else if (absY >= absZ) { axis = 'y'; sign = Math.sign(axisVec.y); }
  else { axis = 'z'; sign = Math.sign(axisVec.z); }

  const layerIndex = Math.round(ds.cubie!.grid[axis]);
  ds.active = false;
  void performMove(axis, layerIndex, (sign || 1) as 1 | -1, true, 200);
  window.setTimeout(() => { if (!state.isBusy && state.controls) state.controls.enabled = true; }, 250);
}

/** 指针抬起：清理拖拽状态。 */
export function onPointerUp(): void {
  const ds = state.dragState;
  if (ds.active) {
    ds.active = false;
    if (state.controls) state.controls.enabled = true;
  }
}
