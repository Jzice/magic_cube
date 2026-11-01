# AGENTS.md

给 AI 编码助手的仓库指南。开始动手前请先读完，并遵守其中的约束。

> 本文件为项目仓库指南。已按真实项目信息填充，动手前请先读完并遵守其中的约束。

## 1. 项目是什么

一个基于 **Three.js + TypeScript + Vite** 的 N 阶魔方模拟器与互动教学工具，由单文件原型 `magic_cube.html`（<https://justice.bj.cn/post/92.scratch/magic_cube.html>）重构而来，现在是 **TypeScript + Vite** 结构化工程，可编译为**单一 HTML 文件**发布。

- 核心库锁定 `Three.js@0.160.0`（与重构前版本一致，保证渲染表现不变）。
- 本项目由单文件原型 `magic_cube.html` 重构而来（原型未纳入仓库，仅作重构参照）。

## 2. 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（localhost:5173），本地解析依赖，不依赖外网
npm run typecheck    # TypeScript 严格模式检查

npm run build        # dist/index.html      完全自包含（Three.js 内联，离线可用）
npm run build:cdn    # dist/index.cdn.html  单文件 + Three.js 走 CDN
npm run build:all    # 一次同时产出以上两种（发布用这个）
```

环境：Node.js 18+。构建前会自动跑 `tsc --noEmit`，类型错误会中断构建。

## 3. 目录与依赖方向

```text
src/
├── main.ts                  # 装配与渲染循环（唯一的编排处）
├── style.css                # 全局样式（玻璃拟态面板、动画、移动端适配）
├── types/                   # 共享类型（Cubie / Move / FaceDef / Solver 等）+ 库类型声明
├── config/                  # 纯数据 + 少量推导（配置即建模）
│   ├── cubeConfig.ts        # 尺寸 / 配色 / 阶数选项 / 打乱步数
│   └── tutorialConfig.ts    # 七步层先法教学数据
├── core/                    # 场景 / 魔方建模 / 转层引擎 / 记号 / 状态 / 动作
│   ├── geometry.ts          # 旋转向量 / 矩阵、轴常量等纯几何工具
│   ├── state.ts             # 全局状态单一数据源（ORDER / cubies / isBusy / …）
│   ├── scene.ts             # 相机 / 渲染器 / 光照 / 阴影 / Fog / OrbitControls
│   ├── cubeModel.ts         # 程序化构建 cubie 与贴纸、isSolved、cubieMap
│   ├── moveEngine.ts        # performMove + 动画循环（整层旋转 + easeInOut 缓动）
│   ├── notation.ts          # Move ↔ 标准记号（R/L/U/D/F/B + ' / 2）互转、公式解析
│   └── actions.ts           # scramble / autoSolve / resetCube 等高层动作
├── interaction/             # 指针拖拽转层与旋转视角
│   └── pointerControls.ts   # pointer 事件射线拾取贴纸、推算转层轴
├── audio/                   # Web Audio 程序化音效
│   └── audioEngine.ts       # 转层咔哒声 / 胜利琶音 / 静音开关
├── solver/                  # 逻辑魔方 + 真求解器 + 调度（无 Three.js 依赖）
│   ├── logicalCube.ts       # 纯逻辑魔方模型（便于 Node 测试）
│   ├── cubeState.ts         # 从 cubies 抽取逻辑 facelet 状态
│   ├── solver.ts            # getSolver 按阶数派发
│   ├── layerSolver2.ts      # 2 阶 IDA\*（双 PDB 启发式）
│   └── layerSolver3.ts      # 3 阶映射 rubiks-cube-solver（CFOP）
└── ui/                      # 顶部控制栏 / 历史 / 教学 / 状态 / Toast
    ├── bootstrap.ts         # 注入 UI 外壳 DOM（顶栏 / 底栏 / 记录 / 教学 / Toast）
    ├── controls.ts          # 绑定顶栏按钮与下拉框
    ├── historyPanel.ts      # 操作记录面板渲染与高亮
    ├── tutorialPanel.ts     # 七步教学面板构建与开合
    └── status.ts            # 状态栏文本 + 居中 Toast
```

**依赖必须保持单向，不要引入循环**：

- `types` ← 所有层（无运行时依赖）。
- `config` ← `core` / `solver` / `ui`（纯数据，单向被依赖）。
- `core` 内部：`scene` / `cubeModel` / `moveEngine` / `notation` / `actions` 依赖 `state` 与 `geometry` 与 `config`；`actions` 编排 `moveEngine` + `solver` + `audio`。
- `solver` 仅依赖 `types` 与 `core/geometry` 与 `cubeState` 的状态抽取；**不依赖 Three.js**，可在 Node 测试。
- `interaction` 依赖 `core/moveEngine` 与 `core/state`，仅调用引擎 API，不接触渲染细节。
- `ui` 依赖 `core/actions`、`core/state`、`audio`、`config`；通过回调触发动作，**不直接 import 渲染模块**。
- `main.ts` 是唯一编排处：装配 scene、构建魔方、绑定 UI 与交互、启动渲染循环。
- 跨模块的"副作用"一律通过函数参数 / 回调注入，不要直接 import 反向调用。

## 4. 核心约定

### 配置即建模

**改业务 = 改 `src/config/`，不要去渲染代码里堆叠构造调用。**

- 魔方由 cubie 集合程序化构建，尺寸 / 配色 / 阶数 / 打乱步数等集中在 `src/config/cubeConfig.ts`，不要去建模代码里堆叠字面量。
- **坐标是中心点，不是角点**：每个 cubie 的 `grid` 用整数网格坐标 `(0..N-1)`，世界坐标 = `(grid - (N-1)/2) * STEP`；轴向 X/Y/Z 与 Three.js 一致。
- 派生量用推导函数生成，**改常量要能自动联动**，不要手写死数值。
- 新增配色 / 阶数选项时，必须同步 `COLORS` / `FACE_CODE` / `ORDER_OPTIONS` 等映射，保证建模与求解状态抽取一致。

### 单文件发布约束

产物要能离线独立打开，因此：

- **不要引入外部资源**（图片、字体、JSON、`fetch` 远程数据）。需要贴图请用 Canvas 程序化生成，或内联为 data URL。
- 升级 `Three.js` 时，必须同步更新 `package.json` 的 `three` 依赖版本与 `vite.config.ts` 的 `THREE_VERSION`，否则 CDN 模式版本不一致。

### 代码风格

- TypeScript **strict**，已开启 `noUnusedLocals` / `noUnusedParameters` 等。避免 `any`。
- 注释与文档使用**简体中文**。
- 状态管理保持轻量（工厂函数 + 闭包），**不要引入状态管理框架**。
- 渲染循环里复用模块级临时对象（如 `Vector3` / `Euler`），不要每帧 `new`。

### 保持既有表现

重构 / 改进的核心要求是**可见行为不变**。除非用户明确要求，不要擅改：

- 视角 / 交互参数与阈值；
- 材质外观、光照与阴影；
- 初始标注 / 初始数值。

## 5. 常见任务该改哪里

| 任务 | 位置 |
| --- | --- |
| 改尺寸 / 配色 / 阶数 / 打乱步数 | `src/config/cubeConfig.ts` |
| 改教学步骤文案 | `src/config/tutorialConfig.ts` |
| 改场景 / 相机 / 光照 / 阴影 / Fog | `src/core/scene.ts` |
| 改魔方建模 / 贴纸 / 还原判定 | `src/core/cubeModel.ts` |
| 改转层动画 / 缓动 / 忙锁 | `src/core/moveEngine.ts` |
| 改记号 / 公式解析 | `src/core/notation.ts` |
| 改打乱 / 自动还原 / 重置 动作 | `src/core/actions.ts` |
| 改指针拖拽转层 / 视角手感 | `src/interaction/pointerControls.ts` |
| 改音效 | `src/audio/audioEngine.ts` |
| 改求解器（2 / 3 阶） | `src/solver/`（logicalCube / cubeState / layerSolver2 / layerSolver3 / solver） |
| 加按钮 / 改 UI 外壳或绑定 | `src/ui/bootstrap.ts` + `src/ui/controls.ts` + `src/style.css` |
| 改操作记录 / 教学 / 状态栏 | `src/ui/{historyPanel,tutorialPanel,status}.ts` |
| 改构建 / 发布方式 | `vite.config.ts` + `scripts/build-all.mjs` |

## 6. 已知陷阱

- **多次构建会互相覆盖**：`build()` 会清空 `outDir`，所以 `scripts/build-all.mjs` 先构建到 `dist/.tmp-<variant>/` 再改名搬运。不要用 `vite build` 多次直接输出到同一 `outDir`。
- **CDN 模式的 importmap 顺序**：必须出现在第一个 module script 之前。`vite.config.ts` 里用 `order: 'pre'` + 替换 `<head>`（而非 `</head>`）实现，改动时不要破坏这个顺序。
- **本项目只有 3D 视图，无 2D 平面图**：原型模板里的 2D 联动约束不适用，不要在代码里预留 floorplan / 2D 模块。
- **构建产物 `dist/` 已 gitignore**：不要提交，也不要手工编辑产物。

## 7. 改完之后怎么验证

```bash
npm run typecheck     # 必须 0 错误
npm run build:all     # 两种产物都要生成成功
```

产物自检（PowerShell）：

```powershell
Get-ChildItem -Recurse dist | Select-Object Name, Length          # 应只有两个 html，无 assets
Select-String -Path dist/index.html -Pattern 'unpkg|importmap|src="/assets'   # 应无输出
Select-String -Path dist/index.cdn.html -Pattern 'importmap'                  # 应有 1 条
```

涉及交互 / 视觉的改动，还需起 `npm run dev` 手动确认。目前没有自动化测试，不要假定有测试兜底。

## 8. 相关文档

| 文档 | 内容 |
| --- | --- |
| [README.md](README.md) | 概览、命令、目录结构 |
| [docs/architecture.md](docs/architecture.md) | 分层依赖、状态机、渲染循环、设计决策 |
| [docs/data-model.md](docs/data-model.md) | 配置结构详解与扩展示例 |
| [docs/build-and-publish.md](docs/build-and-publish.md) | 双模式构建原理与发布方式 |
| [docs/roadmap.md](docs/roadmap.md) | 后续路线 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录（改动请同步追加） |
