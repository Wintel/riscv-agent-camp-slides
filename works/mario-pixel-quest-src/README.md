# Super Wangjian · Pixel Quest —— 网页版源码

第 6 组（龚R垚 · 乐J纬）的作品。这里是**为课程站点做的纯静态版本源码**；线上产物在 `../mario-pixel-quest/`。

## 这版和同学交付的原版有什么不同

原交付包 `mario-world1-riscv-openclaw-bundle.tar.gz` 是一个 Next.js 16 + vinext 项目，跑在 Cloudflare Worker / Node 服务端，用来在 RISC-V 板子上以 `pnpm start:riscv` 起一个局域网服务（见原包里的 `RISCV_DEPLOY.md`）。GitHub Pages 只能放静态文件，所以按原包 `RISCV_DEPLOY.md` 里写明的那条路线，把它迁成了等价的纯静态 Vite 构建。

游戏本体 `src/Game.tsx`（1390 行）和关卡数据 `src/world-1-2-data.mjs` **逐字未改**，只动了一处：精灵图地址由绝对路径 `/character-sprites.png` 改成跟随部署基址，否则放在子目录下会 404。

被替换掉的外壳：

| 原项目 | 这里 |
|---|---|
| `app/layout.tsx`（Next 的 metadata） | `index.html`，标题和描述照抄 |
| `app/page.tsx`（服务端渲染 `<Game/>`） | `src/main.tsx`，客户端挂载 `<Game/>` |
| `worker/`、`db/`、`drizzle/` | 删除 —— 原项目 `db/schema.ts` 本来就是空的，没用到数据库 |
| `tests/rendered-html.test.mjs` 走 Worker 取 SSR 输出 | 改成直接渲染同一个 `Game` 组件，断言逐条保留，另加两条产物检查 |

## 验收

原包 `tests/` 里的回归测试（地图碰撞、金币位置、四条管道路由、四座升降台、跨关卡人物保持、保护框、旗杆动画）全部保留并通过，只把读源码的路径由 `../app/` 改成 `../src/`：

```bash
npm install
npm test          # 11 项全通过：先构建，再跑回归
```

## 重新构建

```bash
npm install
npm run build     # 产物在 dist/，直接覆盖到 ../mario-pixel-quest/
```

`vite.config.ts` 里 `base: "./"` 是关键 —— 站点部署在 `/riscv-agent-camp-slides/works/mario-pixel-quest/` 这样的子目录下，资源必须走相对路径。

## 在 RISC-V 板子上跑原版

原交付包那一套仍然有效（Node 22+、pnpm、`pnpm start:riscv`、监听 3001）。静态版和它是两条独立的路，互不影响。
