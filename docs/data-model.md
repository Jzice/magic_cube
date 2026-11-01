# 数据模型（配置即建模）

> 数据模型说明：已按真实魔方配置结构填写。

## 1. 核心思想

改业务 = 改配置。构件用带类型的数组 / 对象描述，渲染层按配置循环装配，不堆构造调用。

## 2. 坐标约定

- 单位：**STEP（= CUBIE_SIZE + GAP）**，原点位于魔方几何中心；cubie 的 `grid` 为 `(0..N-1)` 整数网格，世界坐标 = `(grid - (N-1)/2) * STEP`。
- 轴向与 Three.js 一致：X 右、Y 上、Z 前。

## 3. 配置结构示例

```ts
// src/config/cubeConfig.ts
export const CUBIE_SIZE = 1;
export const GAP = 0.04;
export const STEP = CUBIE_SIZE + GAP;
export const ORDER_OPTIONS = [2, 3, 4, 5];
export const FACE_CODE: Record<string, string> = { U: 'W', D: 'Y', R: 'R', L: 'O', F: 'G', B: 'B' };
export function scrambleSteps(order: number): number {
  return order <= 3 ? 20 : 24;
}
  material: MaterialKey;
  cast?: boolean; receive?: boolean;
}

export const WALLS: BoxSpec[] = [ /* ... */ ];
```

派生量用函数生成，改常量自动联动：

```ts
const H = 3.5;
function header(w: number, x: number, z: number): BoxSpec {
  return { w, h: 0.4, d: 0.2, x, y: H - 0.2, z, material: 'wall' };
}
```

## 4. 扩展示例

### 加一种构件类型（如家具）

1. `types.ts`：新增类型（如 `FurnitureSpec`）。
2. `config/`：新增数据数组。
3. `buildHouse.ts`：在装配循环里处理该类型（参考现有构件的处理方式）。
4. 若引入新材质，在材质工厂里补实现。

### 加墙 / 加窗

直接往对应配置数组追加条目；若 2D 平面图独立维护，记得同步 `WALLS_2D` / `ROOMS_2D`。
