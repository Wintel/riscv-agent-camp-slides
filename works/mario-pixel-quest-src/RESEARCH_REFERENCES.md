# World 1–2 原版校准依据

本项目的 World 1–2 使用以下公开资料交叉校准：

- Super Mario Wiki 关卡资料：<https://www.mariowiki.com/World_1-2_(Super_Mario_Bros.)>
- NESMaps 完整标注地图：<https://www.nesmaps.com/maps/SuperMarioBrothers/SuperMarioBrosWorld1-2Map.html>
- The Mushroom Kingdom 地图页：<https://themushroomkingdom.net/maps/smb/1-2>

已落实的关键约束：

- 400 秒计时。
- 地表入口通过管道进入地下，并从天花板开口落下。
- 地下主路线有三根连续食人花管道；第一根进入隐藏房，隐藏房出口返回第三根。
- 隐藏房为 17 枚散币加一个可顶 10 次的金币砖，共 27 枚。
- 全关共有 14 只栗宝宝、3 只绿乌龟、1 只红乌龟和 4 株食人花。
- 可获得金币上限 68：34 枚场景散币、3 个最多各出 10 枚的金币砖、4 个金币问号块。
- 地下末段包含两组成对反向运动的四座平台、正常横管出口和屋顶 Warp Zone；正常出口连接带楼梯、旗杆和城堡的地表终点。

为适配本项目 48 像素大格 Canvas，原版 16 像素图块坐标按 3 倍比例绘制；入口、主场景、隐藏房和出口在世界坐标中分区存放，切换时不会串景。

`app/world-1-2-data.mjs` 保存逐行静态碰撞段、17 枚地下散币、17 枚隐藏房散币、奖励砖、敌人、管道和升降台数据。自动测试对静态图块表做 SHA-256 固定值校验，同时验证所有散币均未与实体图块重叠。
