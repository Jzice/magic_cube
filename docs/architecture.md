# 架构设计

> 本文件为模板。复制后按真实架构填写。

## 1. 分层依赖

```text
types ← 所有层
config ← scene / floorplan
view  →（仅以类型）import scene
ui    →（仅回调）不 import 渲染模块
main.ts = 唯一编排处（装配 + 渲染循环 + 连接交互/UI）
```

依赖必须保持单向，禁止循环。跨模块副作用通过构造函数回调注入。

## 2. 状态机

- 视角 / 模式状态由 `view/`（或等价模块）的工厂函数 + 闭包管理，不引入状态管理框架。
- 暴露 `getMode()` / `setMode()` 等窄接口，供 UI 与 2D 模块查询，避免反向依赖。

## 3. 渲染循环

- 主入口 `main.ts` 持有 `requestAnimationFrame` 循环。
- 复用模块级临时 `Vector3` / `Euler`，不每帧 `new`。
- 2D 模式可跳过 WebGL 渲染（刻意设计，不是缺陷）。

## 4. 设计决策

- **配置即建模**：数据驱动，改业务只动 `config/`。
- **双模式单文件**：`vite.config.ts` 用 `mode` 切换，CDN 模式外置 Three.js 并注入 importmap。
- **无外部资源**：贴图程序化生成 / data URL，保证离线单文件可用。
