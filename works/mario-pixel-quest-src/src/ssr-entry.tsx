// 仅供回归测试使用：把 Game 的初始界面渲染成 HTML 字符串，
// 用来替代原项目里基于 Cloudflare Worker 的 SSR 断言。构建产物不包含这个入口。
import { renderToStaticMarkup } from "react-dom/server";
import { Game } from "./Game";

export function renderShell(): string {
  return renderToStaticMarkup(<Game />);
}
