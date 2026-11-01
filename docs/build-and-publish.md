# 构建与发布

> 构建与发布说明：已按真实构建配置（Three.js 0.160.0）填写。

## 1. 两种产物

| 命令 | mode | Three.js 的处理 | 输出文件 | 离线可用 |
| --- | --- | --- | --- | --- |
| `npm run build` | `production`（默认） | 打包并内联进 HTML | `dist/index.html` | ✅ |
| `npm run build:cdn` | `cdn` | 保持裸导入，交给 importmap 从 CDN 拉取 | `dist/index.cdn.html` | ❌ |
| `npm run build:all` | 以上两者 | — | **同时产出上面两个文件** | — |

三个命令都会先执行 `tsc --noEmit`，类型错误会直接中断构建。

## 2. 配置原理

`vite.config.ts` 依据 `mode` 决定是否外置 Three.js 并注入 importmap：

- `vite-plugin-singlefile`：把 JS / CSS 内联进 HTML，得到单文件。
- CDN 模式 `external`：让 Rollup 保留 `import ... from 'three'` 裸导入，不打包进产物。
- `THREE_VERSION` 必须与 `package.json` 的 `three` 版本一致（仅 CDN 模式生效，dev 不受影响）。

### 关键陷阱：importmap 必须先于 module script

浏览器要求 importmap 出现在第一个 module script 之前。插件用 `transformIndexHtml` 的 `order: 'pre'`，并替换 `<head>`（而非 `</head>`）把 importmap 插到最前面：

```ts
transformIndexHtml: {
  order: 'pre',
  handler(html) {
    return html.replace('<head>', `<head>\n<script type="importmap">…</script>`);
  },
}
```

## 3. 为什么需要 `scripts/build-all.mjs`

Vite 每次 `build()` 都会清空 `outDir`，若两次构建都直接输出到 `dist/`，后一次会覆盖前一次。脚本让每种模式先构建到 `dist/.tmp-<variant>/`，再把 `index.html` **改名**搬到 `dist/` 根目录：

```text
build(mode=production, outDir=dist/.tmp-offline) → dist/index.html
build(mode=cdn,        outDir=dist/.tmp-cdn)     → dist/index.cdn.html
```

- `build:all` 先清空整个 `dist/`，保证产物干净。
- 单目标构建只覆盖自己的文件，保留另一个产物。

## 4. 本地验证

```bash
npm run build:all
```

```powershell
# dist 下应当只有两个 html，没有 assets 目录
Get-ChildItem -Recurse dist | Select-Object Name, Length

# 自包含版本不应有外链 / importmap（应无输出）
Select-String -Path dist/index.html -Pattern 'unpkg|importmap|src="/assets'

# CDN 版本应能查到 importmap（应至少 1 条）
Select-String -Path dist/index.cdn.html -Pattern 'importmap'
```

## 5. 发布方式

- **直接分发**：把 `dist/index.html` 发对方双击打开（离线）；或发体积更小的 `dist/index.cdn.html`。
- **静态托管**：整个 `dist/` 上传到任意静态服务，两个文件共存不冲突。
- **GitHub Pages**：见 `.github/workflows/deploy-pages.yml`（push main / release / 手动触发）。
- **GitHub Release**：见 `.github/workflows/release.yml`（打 tag / 手动触发，附两个产物）。

### 选择建议

- 离线 / 内网演示 / 客户交付 → 自包含模式（`npm run build`）。
- 线上页面且网络正常 → CDN 模式（`npm run build:cdn`），首包体积显著下降；可把 importmap 指向私有镜像，只需改 `THREE_VERSION` 与 URL。

## 6. 已知约束

- 自包含模式把整个 Three.js 内联，文件较大但换来完全离线。
- 升级 Three.js 时务必同步 `package.json` 与 `vite.config.ts` 的版本号。
