import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnimState, Cubie, Move } from '../types';

export interface DragState {
  active: boolean;
  started: boolean;
  cubie: Cubie | null;
  faceNormal: THREE.Vector3 | null;
  startX: number;
  startY: number;
}

/**
 * 运行时单一数据源。各模块只读或经本对象与核心接口更新，避免全局变量散落。
 */
export const state = {
  ORDER: 3,
  cubies: [] as Cubie[],
  cubieMap: new Map<string, Cubie>(),

  scene: null as THREE.Scene | null,
  camera: null as THREE.PerspectiveCamera | null,
  renderer: null as THREE.WebGLRenderer | null,
  controls: null as OrbitControls | null,
  raycaster: null as THREE.Raycaster | null,
  pointer: null as THREE.Vector2 | null,

  dragState: {
    active: false,
    started: false,
    cubie: null,
    faceNormal: null,
    startX: 0,
    startY: 0,
  } as DragState,

  animState: null as AnimState | null,
  pivotGroup: null as THREE.Group | null,

  /** 物理旋转历史（用于 4/5 阶兜底还原与状态一致性）。 */
  moveHistory: [] as Move[],
  /** 符号化历史（用于 UI 操作记录）。 */
  notationHistory: [] as string[],

  isBusy: false,
  /** 高层动作互斥锁：打乱 / 求解回放期间禁止其它操作插入，保证动作序列不交错。 */
  operationLocked: false,
  isMuted: false,
  audioCtx: null as AudioContext | null,
};

export type AppState = typeof state;
