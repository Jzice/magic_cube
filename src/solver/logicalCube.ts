import * as THREE from 'three';
import type { Axis, Cubie } from '../types';
import { rotateGrid, rotateVector } from '../core/geometry';
import { FACE_CODE } from '../config/cubeConfig';

export type Dir = { x: number; y: number; z: number };

/** 六个面的外法线方向与中心颜色（标准配色：U白 W / D黄 Y / F绿 G / B蓝 B / R红 R / L橙 O）。 */
export const FACE_DIR: Record<string, Dir> = {
  U: { x: 0, y: 1, z: 0 },
  D: { x: 0, y: -1, z: 0 },
  R: { x: 1, y: 0, z: 0 },
  L: { x: -1, y: 0, z: 0 },
  F: { x: 0, y: 0, z: 1 },
  B: { x: 0, y: 0, z: -1 },
};

export const FACE_CENTER_COLOR: Record<string, string> = {
  U: 'W', D: 'Y', R: 'R', L: 'O', F: 'G', B: 'B',
};

export interface Piece {
  pos: { x: number; y: number; z: number };
  /** 该 cubie 各外露贴纸的颜色代号 -> 当前朝向（世界方向单位向量）。 */
  normals: Map<string, Dir>;
}

/** 纯逻辑魔方（不依赖 Three.js），用于求解器规划与 Node 冒烟测试。 */
export class LogicalCube {
  order: number;
  pieces: Piece[] = [];

  constructor(order: number) {
    this.order = order;
  }

  /** 由阶数构造已还原的逻辑魔方。 */
  static solved(order: number): LogicalCube {
    const cube = new LogicalCube(order);
    const offset = (order - 1) / 2;
    const addFace = (p: Piece, cond: boolean, axis: Axis, sign: 1 | -1, code: string): void => {
      if (!cond) return;
      p.normals.set(code, {
        x: axis === 'x' ? sign : 0,
        y: axis === 'y' ? sign : 0,
        z: axis === 'z' ? sign : 0,
      });
    };
    for (let ix = 0; ix < order; ix++) {
      for (let iy = 0; iy < order; iy++) {
        for (let iz = 0; iz < order; iz++) {
          const p: Piece = { pos: { x: ix, y: iy, z: iz }, normals: new Map() };
          addFace(p, ix === order - 1, 'x', 1, FACE_CENTER_COLOR.R);
          addFace(p, ix === 0, 'x', -1, FACE_CENTER_COLOR.L);
          addFace(p, iy === order - 1, 'y', 1, FACE_CENTER_COLOR.U);
          addFace(p, iy === 0, 'y', -1, FACE_CENTER_COLOR.D);
          addFace(p, iz === order - 1, 'z', 1, FACE_CENTER_COLOR.F);
          addFace(p, iz === 0, 'z', -1, FACE_CENTER_COLOR.B);
          cube.pieces.push(p);
        }
      }
    }
    void offset;
    return cube;
  }

  /** 由 3D cubies 抽取当前逻辑状态（用于求解器的输入）。 */
  static fromCubies(order: number, cubies: Cubie[]): LogicalCube {
    const cube = new LogicalCube(order);
    const tmp = new THREE.Vector3();
    for (const c of cubies) {
      const normals = new Map<string, Dir>();
      for (const [key, mesh] of Object.entries(c.stickers)) {
        if (!mesh) continue;
        const n0 = mesh.userData.normal as THREE.Vector3;
        tmp.copy(n0).applyMatrix4(c.orientation);
        normals.set(FACE_CODE[key as keyof typeof FACE_CODE], {
          x: Math.round(tmp.x),
          y: Math.round(tmp.y),
          z: Math.round(tmp.z),
        });
      }
      cube.pieces.push({
        pos: { x: Math.round(c.grid.x), y: Math.round(c.grid.y), z: Math.round(c.grid.z) },
        normals,
      });
    }
    return cube;
  }

  clone(): LogicalCube {
    const c = new LogicalCube(this.order);
    c.pieces = this.pieces.map((p) => ({
      pos: { ...p.pos },
      normals: new Map([...p.normals].map(([k, v]) => [k, { ...v }])),
    }));
    return c;
  }

  /** 应用一次转层（与 3D 表现完全一致：rotateGrid + 方向向量旋转）。 */
  applyMove(axis: Axis, layerIndex: number, dir: 1 | -1): void {
    for (const p of this.pieces) {
      if (Math.round(p.pos[axis]) !== layerIndex) continue;
      p.pos = rotateGrid(p.pos, axis, dir, this.order);
      const next = new Map<string, Dir>();
      for (const [code, v] of p.normals) next.set(code, rotateVector(v, axis, dir));
      p.normals = next;
    }
  }

  /** 是否已还原：每个贴纸朝向的面的中心颜色 == 该贴纸颜色。 */
  isSolved(): boolean {
    for (const p of this.pieces) {
      for (const [code, v] of p.normals) {
        const face = this.faceOfDir(v);
        if (face && FACE_CENTER_COLOR[face] !== code) return false;
      }
    }
    return true;
  }

  faceOfDir(v: Dir): string | null {
    for (const [name, d] of Object.entries(FACE_DIR)) {
      if (this.eqDir(v, d)) return name;
    }
    return null;
  }

  eqDir(a: Dir, b: Dir, eps = 1e-6): boolean {
    return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
  }

  /** 按颜色集合查找 piece（set 排序后比对）。 */
  findPiece(colors: string[]): Piece | null {
    const key = [...colors].sort().join(',');
    for (const p of this.pieces) {
      if ([...p.normals.keys()].sort().join(',') === key) return p;
    }
    return null;
  }

  normalOf(p: Piece, color: string): Dir | undefined {
    return p.normals.get(color);
  }
}
