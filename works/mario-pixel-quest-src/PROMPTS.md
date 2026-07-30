# 项目提示词归档

## 产品实现提示词

> 在新文件夹中制作一个高精度的马里奥小游戏，不发布网站。标题使用 SUPER WANGJIAN。补全 World 1–1 至 1–4，按原版地图网格复刻，修正 1–1 金币位置。World 1–2 按原版 192×15 图块地图和数据重建地表入口、地下主路线、27 金币隐藏房、14 只栗宝宝、3 只绿乌龟、1 只红乌龟，删除该关全部食人花，保留四座成对反向移动升降台、正常出口地表和屋顶 Warp Zone。1–1 至 1–3 需要旗杆下滑、终点旗下降、人物自动走进城堡、城堡旗升起的完整过关动画。提高人物跳跃高度。把用户提供的像素人物“王健”做进游戏，开局提供“经典马里奥 / 王健”人物选择，切换关卡时必须保持所选人物。为两名角色分别适配蘑菇保护框。键盘、鼠标和触控都可操作。保留计分、金币、生命、暂停、声音开关和连续过关流程。地图数据与测试共用同一来源，并真实走通入口、隐藏房往返、正常出口和旗杆路线。

## 人物资源处理提示词

以下提示词用于内置图像编辑工具，生成项目中的透明人物精灵源图：

> Use case: background-extraction  
> Asset type: four-frame pixel-art character sprite sheet for a browser platform game  
> Primary request: preserve the four existing character poses exactly and isolate them on a perfectly flat solid #ff00ff chroma-key background suitable for transparent removal.  
> Input image: the supplied image is the edit target and identity/pose/color reference.  
> Composition: keep the same left-to-right order: standing, running, jumping, celebrating; keep generous separation and do not crop any pose.  
> Style: exact crisp pixel art, no antialiasing, no reinterpretation.  
> Constraints: keep the character's face, glasses, black suit, white shirt, striped blue tie, proportions, poses, lighting, pixel edges, and all details unchanged. Background must be one uniform #ff00ff with no gradient, texture, shadow, text, watermark, or extra object. Do not use #ff00ff inside the character.  
> Avoid: redesign, extra frames, missing limbs, blurred edges, altered identity, changed pose, changed clothing.

生成后的洋红背景通过本地色键处理移除，最终透明资源为 `public/character-sprites.png`。

## 部署代理提示词

完整、可直接粘贴的部署提示词位于 `OPENCLAW_DEEPSEEK_PROMPT.md`，其中已经写入：

- 目标 IP `192.168.31.105`
- 默认端口 `3001`
- 禁止使用 `8000`、`8080`
- RISC-V 依赖兼容回退策略
- 启动后验证要求
