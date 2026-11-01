# N 阶魔方模拟器（Three.js）

一个基于 **Three.js + TypeScript + Vite** 的 N 阶魔方模拟器与互动教学工具，由单文件原型 [`magic_cube.html`](https://justice.bj.cn/post/92.scratch/magic_cube.html) 工程化重构而来。可一键编译为**单一 HTML 文件**发布，支持「完全自包含（离线）」与「Three.js 走 CDN」两种形态。

---

## 特性

- **2–5 阶魔方**：程序化构建圆角方块本体与六面贴纸材质，随时切换阶数。
- **直觉交互**：拖拽贴纸转层、拖拽空白处旋转视角、滚轮缩放（轨道控制器）。
- **随机打乱 / 一键重置**：打乱步数 ≤3 阶 20 步、否则 24 步。
- **真正的自动求解**（非逆序回放）：
  - **2 阶**：内置 IDA\* 求解器（角块排列 + 朝向双模式数据库），任意打乱状态均可还原。
  - **3 阶**：调用成熟求解库 `rubiks-cube-solver`（CFOP）并精确映射回本引擎动作，任意打乱状态均可还原。
  - **4 / 5 阶**：当前采用「逆序回放历史」兜底（见下方说明），后续将引入 reduction 降阶复用 3 阶求解。
- **音效开关**：Web Audio 程序化合成「咔哒」转层声与胜利琶音，无音频文件。
- **7 步层先法互动教学**：单步 token 演示 + 整步一键演示，与 3 阶求解思路一一对应。
- **操作记录面板 / 状态栏 / Toast**：记录最近 30 步并高亮求解步骤。
- **移动端响应式**：窄屏隐藏记录面板、教学面板全宽。

---

## 快速开始

```bash
npm install     # 安装依赖
npm run dev     # 启动开发服务器（默认 http://localhost:5173）
```

环境要求：Node.js 18+（推荐 20 LTS）。

---

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器，多文件源码 + 热更新 |
| `npm run typecheck` | 仅执行 TypeScript 严格模式类型检查 |
| `npm run build` | 产出**完全自包含**的 `dist/index.html`（Three.js 一并内联，离线可用） |
| `npm run build:cdn` | 产出**单文件 + Three.js 走 CDN** 的 `dist/index.cdn.html` |
| `npm run build:all` | **一次同时产出以上两种产物**（发布时推荐） |
| `npm run preview` | 预览构建产物 |

---

## 发布

```bash
npm run build:all
```

一次构建即在 `dist/` 得到两个**独立的单文件**：

```text
dist/
├── index.html        # 完全自包含，离线可用
└── index.cdn.html    # Three.js 走 CDN，需联网
```

任选其一双击打开或托管到任意静态服务器即可，两者互不依赖。

| 产物 | 是否需要联网 | 适用场景 |
| --- | --- | --- |
| `index.html` | 否 | 离线演示、邮件附件、内网交付 |
| `index.cdn.html` | 是（拉取 CDN 上的 Three.js） | 线上页面，减小首包体积 |

> 单目标构建（`build` / `build:cdn`）只覆盖对应文件，不会删掉另一个产物。
> 构建原理与两种模式的差异见 [docs/build-and-publish.md](docs/build-and-publish.md)。

### GitHub Release 与 Pages

- **GitHub Release**：打 `v*` tag 或手动触发 `release.yml` 工作流，自动 `build:all` 并创建 Release、附加两个 html 产物。
- **GitHub Pages**：仓库 Settings → Pages → Source 选 GitHub Actions；push `main` / 发布 Release / 手动触发 `deploy-pages.yml` 即自动部署 `dist/` 为站点。

---

## 目录结构

```text
magic_cube/
├── index.html                    # 入口 HTML（仅 DOM 结构）
├── package.json
├── tsconfig.json                 # strict 严格模式
├── vite.config.ts                # 双模式构建配置
├── scripts/
│   ├── build-all.mjs             # 构建脚本：一次产出两种单文件产物
│   ├── test-solver.ts            # 3 阶求解器冒烟测试（500 组随机）
│   └── test-solver2.ts           # 2 阶求解器冒烟测试（300 组随机）
└── src/
    ├── main.ts                   # 装配与渲染循环
    ├── style.css
    ├── types/                    # 全局共享类型
    ├── config/                   # 尺寸 / 配色 / 阶数 / 教学步骤数据
    ├── core/                     # 场景 / 魔方建模 / 转层引擎 / 记号 / 状态 / 动作
    ├── interaction/              # 指针拖拽转层与视角
    ├── audio/                    # Web Audio 音效
    ├── solver/                   # 逻辑魔方 + 2/3 阶求解器 + 调度
    └── ui/                       # 顶栏 / 历史 / 教学 / 状态面板
```

---

## 求解器说明

| 阶数 | 算法 | 适用范围 |
| --- | --- | --- |
| 2 | IDA\*（角块排列 40320 + 朝向 6561 双 PDB 启发式） | 任意打乱状态 |
| 3 | `rubiks-cube-solver`（CFOP） + 动作映射 | 任意打乱状态 |
| 4 / 5 | 逆序回放历史（兜底） | 仅限由本程序操作产生的状态 |

> 4 / 5 阶的 reduction（拼中心 + 配对边后降为 3×3）仍在路线中，见 [docs/roadmap.md](docs/roadmap.md)。

---

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 架构分层、依赖方向、视角状态机、渲染循环、求解器 |
| [docs/data-model.md](docs/data-model.md) | 配置即建模：各配置结构说明与扩展示例 |
| [docs/build-and-publish.md](docs/build-and-publish.md) | 双模式构建原理、产物对比、发布方式 |
| [docs/roadmap.md](docs/roadmap.md) | 后续路线 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |
