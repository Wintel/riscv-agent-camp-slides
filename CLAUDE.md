# CLAUDE.md

给在本仓库工作的 Claude 的项目说明。开始动手前请通读一遍。

## 项目背景

上海交通大学（SJTU）学森暑期营 **「零基础 RISC-V 芯片智能体开发」** 教学材料。课程主线：先教学生连接 RISC-V 板子、掌握 Linux 基础，再学会用 **AI 智能体（agent）** 在板子上做开发。**注意：是"用智能体做开发"，不是"做智能体"。**

- **受众**：零 Linux 经验的高中生。语气要**友好、具体、多用生活比喻**（如 IP=门牌号、端口=门、SSH=加密隧道）。
- **语言**：所有面向学生的内容用**中文**。
- **硬件**：Milk-V Titan（MINI-ITX RISC-V 工作站）。SoC = UltraRISC **UR-DP1000**，8 核 RV64（RVA22），最高 2.0GHz；DDR4 最高 64GB；千兆 RJ45；M.2 NVMe；USB3；Type-C 串口。可装 Ubuntu/Debian/Fedora。资料：milkv.io/titan
- **参考教材**：MIT Missing Semester 中文版 — missing-semester-cn.github.io
- **课程进度**：第 1 课（Linux + 命令行 + 网络/IP + SSH）已完成；**第 2 课预计是"在 Titan 上用 AI 智能体做开发"**。

## 仓库内容

| 文件 | 说明 |
|---|---|
| `linux-camp-slides.html` | 第 1 课完整讲义，43 页，单文件 |
| `template.html` | 精简可复用模板（同一套设计系统 + 引擎） |
| `sjtu.png` | 交大 logo（316×316 RGBA），被 html 以相对路径引用 |
| `README.md` | 面向使用者的文档 |

## 交付格式约定

- **默认用自建 HTML 幻灯片系统，不用 PowerPoint。** 理由：动画丰富、可离线投影、单文件易编辑。若用户明确要 `.pptx` 再转（并说明动画会简化）。
- **logo 用相对路径 `sjtu.png`**（本地放映最简单）。若要做**可分享的单文件 / Artifact 在线预览**，需把 logo 内嵌为 base64 data URI —— 用 **Node** 做替换（UTF-8 可靠），不要用 PowerShell 读写含中文的 html（可能按 GBK 误读导致乱码）：
  ```
  node -e "const fs=require('fs');const b=fs.readFileSync('sjtu.png').toString('base64');let h=fs.readFileSync('linux-camp-slides.html','utf8');h=h.replace(/sjtu\.png/g,'data:image/png;base64,'+b);fs.writeFileSync('out.html',h,'utf8')"
  ```
  发布为 Artifact 时还需去掉 `<!DOCTYPE>/<html>/<head>/<body>` 外壳（工具会自行包裹）。

## 幻灯片系统架构（改动前必读）

- **舞台**：固定逻辑画布 **1280×720**，JS 按视口等比 `scale()`。**所有尺寸按这个画布用 px 设计。**
- **一页 = 一个** `<section class="slide" data-sec="章节名">`。`data-sec` 显示在右上角；页码/总数由 JS 自动算，**不要硬编码**。
- **翻页引擎**（底部 `<script>`，两文件一致）：管理键盘/鼠标/触屏翻页、`.frag` 逐步显现、进度条、缩放。**非必要不改引擎。**
- **逐步显现**：元素加 `class="frag"`（可选 `pop`/`right`），按 DOM 顺序逐次 `.revealed`。**frag 数量 = 该页需要点击的次数**，注意讲课节奏。
- **进场动画**：`rise`/`rise-2`/`rise-3` 在该页变 `.active` 时播放。
- **SVG 描线动画**：给 path/line 加 `class="draw"`（适用路径长度 ≲ 2000px）；行进虚线用 `class="flow"`。
- **配色/字体**：全部集中在顶部 `:root{}` 变量。品牌红 `#AD1730`（取自 logo，是唯一强调色）。

## 内容编写雷区

- **终端窗口**：`.term-body` 是 `white-space:normal`，每一行必须用 `<span class="ln">` 包裹（`.ln` 自带 `pre-wrap` 保留行内多空格对齐）。这样 span 之间源码换行会被折叠，**不会产生多余空行**。别把整段终端文本直接塞进去。
  - 行内颜色类：`u`(用户名绿)、`p`(路径蓝)、`cmd`(命令白)、`out`(输出灰)、`em`(强调红)、`ok`(绿)、`cm`(注释)。
- **HTML 转义**：正文/终端里的 `>` `<` `&` 要写成 `&gt;` `&lt;` `&amp;`（重定向、`&&` 等），否则可能被当作标签解析。
- **字体**：中文 CJK 字体**不可内嵌**（太大 + CSP），依赖系统字体栈（Windows 上是微软雅黑）。这是有意为之，别尝试用 webfont CDN。
- **SSH 页占位符** `student@192.168.1.50` 是假的；提醒用户换成真实板子账号（官网无默认凭据，装系统时才设定）。

## 改完如何自检

用 Node 快速校验（本机有 node）：

```
node -e "const fs=require('fs');let h=fs.readFileSync('linux-camp-slides.html','utf8');
const m=h.match(/<script>([\s\S]*?)<\/script>/); new Function(m[1]);           // JS 语法
let b=h.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'');        // 去注释再数标签
console.log('section',(b.match(/<section[ >]/g)||[]).length,(b.match(/<\/section>/g)||[]).length);
console.log('div',(b.match(/<div[ >]/g)||[]).length,(b.match(/<\/div>/g)||[]).length);"
```

要点：`<section>`/`<div>` 开合数量相等；JS `new Function` 不报错。数标签**务必先去掉注释**——CSS/HTML 注释里若出现 `<section` 字样会造成假告警。
