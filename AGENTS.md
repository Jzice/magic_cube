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
├── main.ts                  # 装配 + 渲染循环（唯一的编排处）
├── types.ts                 # 共享类型，无运行时依赖
├── config/                  # 纯数据 + 少量推导（配置即建模）
├── scene/                   # 场景装配 / 材质 / 构件 / 构建
├── view/                    # 视角状态机 / 键鼠交互
├── floorplan/               # 2D 平面图（如适用）
└── ui/                      # 按钮绑定与状态同步
```

**依赖必须保持单向，不要引入循环**：

- `types` ← 所有层；`config` ← `scene` / `floorplan`。
- `view` **只能以类型方式** import `scene`（取 `SceneContext`），不得反向调用场景构建逻辑。
- `floorplan` **不得** import `view`：通过 `getMode()` 回调获知当前模式，重绘动作由 `main.ts` 注入。
- `ui` **不得** import 任何渲染模块：只做 DOM 与回调，具体动作由 `main.ts` 编排。
- 跨模块的"副作用"一律通过构造函数回调注入，不要直接 import。

## 4. 核心约定

### 配置即建模

**改业务 = 改 `src/config/`，不要去渲染代码里堆叠构造调用。**

- 构件用带类型的数组 / 对象描述（如 `BoxSpec`：`{ w, h, d, x, y, z, material, ... }`）。
- **坐标是中心点，不是角点**：每个 cubie 的 `grid` 用整数网格坐标 `(0..N-1)`，世界坐标 = `(grid - (N-1)/2) * STEP`；轴向 X/Y/Z 与 Three.js 一致。
- 派生量用推导函数生成，**改常量要能自动联动**，不要手写死数值。
- 新增 `MaterialKey` / 构件类型时，必须同时在对应工厂里给出实现。

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
| 改尺寸 / 加构件 / 改布局 | `src/config/` |
| 改材质或贴图 | `src/scene/materials.ts` |
| 改构件构造细节 | `src/scene/builders.ts` |
| 改视角切换 / 移动手感 | `src/view/viewState.ts` |
| 改键鼠交互 | `src/view/interaction.ts` |
| 改 2D 平面图（如适用） | `src/floorplan/` |
| 加按钮、改 UI 状态 | `index.html`（DOM）+ `src/ui/ui.ts` + `src/style.css` |
| 改构建 / 发布方式 | `vite.config.ts` + `scripts/build-all.mjs` |

## 6. 已知陷阱

- **多次构建会互相覆盖**：`build()` 会清空 `outDir`，所以 `scripts/build-all.mjs` 先构建到 `dist/.tmp-<variant>/` 再改名搬运。不要用 `vite build` 多次直接输出到同一 `outDir`。
- **CDN 模式的 importmap 顺序**：必须出现在第一个 module script 之前。`vite.config.ts` 里用 `order: 'pre'` + 替换 `<head>`（而非 `</head>`）实现，改动时不要破坏这个顺序。
- **3D 与 2D 是两套独立数据**（如适用）：改 3D 后必须手动同步 2D，否则两视图不一致。
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
