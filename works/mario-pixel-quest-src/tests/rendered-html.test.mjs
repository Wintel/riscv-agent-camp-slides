// 原版本从 dist/server/index.js（Cloudflare Worker）取 SSR 输出做断言。
// 迁移成纯静态构建后不再有 Worker，这里改成直接渲染同一个 Game 组件，
// 断言逐条保留；另外补一条构建产物必须走相对路径的检查（子目录部署会用到）。
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function render() {
  const { renderShell } = await import(new URL("../dist-ssr/ssr-entry.js", import.meta.url).href);
  return renderShell();
}

test("renders the Mario game shell", async () => {
  const html = await render();

  assert.match(html, /SUPER WANGJIAN/);
  assert.match(html, /选择人物/);
  assert.match(html, /经典马里奥/);
  assert.match(html, /王健/);
  assert.match(html, /从 1–1 开始/);
  assert.match(html, /进入管道/);
  assert.match(html, /<canvas/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("page shell carries the original title and description", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Super Wangjian · Pixel Quest<\/title>/i);
  assert.match(html, /一款可离线游玩的高精度横版像素王健小游戏。/);
});

test("static build ships its assets with relative paths", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  // 站点部署在子目录下，绝对路径资源会 404
  assert.doesNotMatch(html, /(src|href)="\/(?!\/)/);
  assert.match(html, /src="\.\/assets\/.+\.js"/);
  await readFile(new URL("../dist/character-sprites.png", import.meta.url));
});
