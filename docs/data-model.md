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

// 面定义：每个面一个轴向 + 法向符号 + 颜色（0xRRGGBB）
export interface FaceDef { key: string; axis: 'x'|'y'|'z'; sign: 1|-1; normal: THREE.Vector3; color: number; }
export const FACE_DEFS: FaceDef[] = [ /* U/D/R/L/F/B 共 6 面 */ ];

// 面 → 求解库颜色字母 的映射（3 阶状态抽取用）
export const FACE_CODE: Record<string, string> = { U: 'W', D: 'Y', R: 'R', L: 'O', F: 'G', B: 'B' };

// 打乱步数：≤3 阶 20 步，否则 24 步（派生量，改常量自动联动）
export function scrambleSteps(order: number): number { return order <= 3 ? 20 : 24; }
```

## 4. 扩展示例

### 增加一种配色方案

1. `src/config/cubeConfig.ts`：在 `COLORS` / `FACE_DEFS` 中调整颜色值。
2. 若改了面的颜色字母，同步 `FACE_CODE`（用于 3 阶求解器的状态字符串映射，见 `layerSolver3.ts`）。
3. `cubeModel.ts` 的贴纸材质由 `COLORS` 推导，无需改动建模代码。

### 支持更多阶数

1. `ORDER_OPTIONS` 追加阶数（如 `6`）。
2. 确认 `scrambleSteps` 的步数策略是否覆盖新阶数。
3. 4 / 5 阶当前自动还原为逆序回放兜底；若要做真求解，新增 `src/solver/reduction.ts`（拼中心 + 配对边降为 3×3）并在 `solver.ts` 注册。
