# 架构设计

> 架构说明：已按真实工程（Three.js N 阶魔方模拟器）填写。

## 1. 分层依赖

```text
types   ← 所有层（无运行时依赖）
config  ← core / solver / ui（纯数据，单向被依赖）
core    ← main.ts 编排；interaction / ui / audio 依赖其引擎 API
solver  ← 仅依赖 types + core/geometry + cubeState（无 Three.js，可 Node 测试）
ui      ← 仅以回调依赖 core/actions 与 config；不 import 渲染模块
main.ts = 唯一编排处（装配 + 渲染循环 + 连接交互/UI/求解）
```

依赖必须保持单向，禁止循环。跨模块副作用通过函数参数 / 回调注入。

## 2. 状态与编排

- 全局状态由 `core/state.ts` 的工厂闭包集中管理（`ORDER` / `cubies` / `cubieMap` / `moveHistory` / `notationHistory` / `isBusy` / `isMuted` 等），不引入状态管理框架。
- `isBusy` 表示单次转层动画进行中；`operationLocked` 表示打乱 / 求解回放等高层动作序列进行中，期间禁止其它按钮、拖拽与教学公式插入，避免动作序列交错。两者配合 OrbitControls 的 `controls.enabled` 防抖。
- UI（顶栏 / 教学 / 历史 / 状态栏）只读状态或通过 `actions` 触发动作，避免反向依赖渲染模块。

## 3. 渲染循环

- 主入口 `main.ts` 持有 `requestAnimationFrame` 循环，调 `core/moveEngine` 的 `startLoop`。
- 复用模块级临时 `Vector3` / `Matrix4`，不每帧 `new`。
- 转层用 `pivotGroup.attach()` 整层旋转 + `animate()` 中 easeInOutCubic 缓动，`scene.attach()` 回贴，与原版机制一致。

## 4. 设计决策

- **配置即建模**：数据驱动，尺寸 / 配色 / 阶数 / 教学步骤集中在 `config/`，改业务只动 `config/`。
- **真求解器与渲染解耦**：`solver/` 为纯逻辑模型，不依赖 Three.js，可在 Node 跑冒烟测试（`scripts/test-solver*.ts`）。
- **3 阶中心归位**：中层（M/E/S）动作会位移中心块，标准 Kociemba 求解器假定中心固定。中层动作可分解为「外层动作 + 魔方整体旋转」，`solver/centerFrame.ts` 用 BFS 枚举 24 种整体旋转把六个中心送回标准方位，归位动作作为解法前缀；`solveVerified` 从原始状态干跑「前缀 + 解法」的完整序列校验。
- **统一历史回放兜底**：`core/actions.ts` 的 `replayFromHistory` 只做结构校验（`validateLogical`，不要求 3 阶中心固定），供 4/5 阶与 2/3 阶标准求解失败时共用；状态栏区分「自动求解」与「按操作历史逆序还原」。
- **双模式单文件**：`vite.config.ts` 用 `mode` 切换，CDN 模式外置 Three.js 并注入 importmap。
- **无外部资源**：材质用 `MeshPhysicalMaterial` 程序化生成、音效用 Web Audio 合成，保证离线单文件可用。
