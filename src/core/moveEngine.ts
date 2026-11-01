import * as THREE from 'three';
import type { AnimState, Axis, Cubie } from '../types';
import { state } from './state';
import { gridKey } from './cubeModel';
import { isSolved } from './cubeModel';
import { rotateGrid } from './geometry';
import { moveToNotation } from './notation';
import { playMoveSound, playWinSound } from '../audio/audioEngine';
import { updateHistoryUI } from '../ui/historyPanel';
import { updateStatus } from '../ui/status';

/** 取得某轴上某层的所有 cubie。 */
export function getLayerCubies(axis: Axis, layerIndex: number): Cubie[] {
  return state.cubies.filter((c) => Math.round(c.grid[axis]) === layerIndex);
}

/**
 * 执行一次转层。animate=false 立即完成（用于求解器逐帧外的逻辑步骤）。
 * record=false 时不写入历史（求解器回放用它，避免污染 moveHistory）。
 */
export function performMove(
  axis: Axis,
  layerIndex: number,
  dir: 1 | -1,
  animate = true,
  duration = 220,
  record = true,
  sound = true,
): Promise<void> {
  if (state.isBusy && animate) return Promise.resolve();
  if (state.animState && animate) return Promise.resolve();

  const layerCubies = getLayerCubies(axis, layerIndex);
  if (layerCubies.length === 0) return Promise.resolve();

  if (animate && record) {
    state.moveHistory.push({ axis, layerIndex, dir });
    const notation = moveToNotation(axis, layerIndex, dir);
    state.notationHistory.push(notation);
    updateHistoryUI();
  }
  if (animate && sound) playMoveSound();

  const pivot = new THREE.Group();
  state.scene!.add(pivot);
  layerCubies.forEach((c) => pivot.attach(c.group));

  const targetAngle = (Math.PI / 2) * dir;
  const axisVec = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const rotMat = new THREE.Matrix4().makeRotationAxis(axisVec, targetAngle);
  layerCubies.forEach((c) => {
    const rg = rotateGrid(c.grid, axis, dir, state.ORDER);
    c.grid.set(rg.x, rg.y, rg.z);
    c.orientation.premultiply(rotMat);
  });
  state.cubieMap.clear();
  state.cubies.forEach((c) => state.cubieMap.set(gridKey(c.grid), c));

  return new Promise<void>((resolve) => {
    if (!animate) {
      layerCubies.forEach((c) => state.scene!.attach(c.group));
      state.scene!.remove(pivot);
      state.isBusy = false;
      resolve();
      return;
    }
    const animState: AnimState = {
      pivotGroup: pivot,
      axisVec,
      targetAngle,
      duration,
      startTime: performance.now(),
      resolve,
      layerCubies,
    };
    state.animState = animState;
    state.isBusy = true;
    if (state.controls) state.controls.enabled = false;
  });
}

/** 启动渲染循环（同时推进转层动画）。 */
export function startLoop(): void {
  const loop = (): void => {
    requestAnimationFrame(loop);
    const now = performance.now();

    const anim = state.animState;
    if (anim) {
      const t = Math.min((now - anim.startTime) / anim.duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const angle = eased * anim.targetAngle;
      anim.pivotGroup.quaternion.setFromAxisAngle(anim.axisVec, angle);

      if (t >= 1) {
        anim.pivotGroup.quaternion.setFromAxisAngle(anim.axisVec, anim.targetAngle);
        anim.pivotGroup.updateMatrixWorld(true);
        anim.layerCubies.forEach((c) => state.scene!.attach(c.group));
        state.scene!.remove(anim.pivotGroup);
        const resolve = anim.resolve;
        state.animState = null;
        state.isBusy = false;
        if (state.controls) state.controls.enabled = true;

        if (isSolved()) {
          updateStatus('✅ 已还原！');
          playWinSound();
        }
        resolve();
      }
    }

    if (state.controls) state.controls.update();
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera);
    }
  };
  loop();
}
