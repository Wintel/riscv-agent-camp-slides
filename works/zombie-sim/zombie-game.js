
// ================================================================
//  🧟 丧尸捉人模拟器
//  · 100 蓝色小球 = 幸存者（逃出门获救）
//  · 15  红色小球 = 丧尸（接触幸存者→5秒变丧尸）
//  · 5   白色小球 = 军人（击杀周围15球直径内的丧尸）
//  · 大密室四面各有一扇门
// ================================================================

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const W = 1000, H = 700;

// ═══════════════════════════════════════════════════════════════
//  常量配置
// ═══════════════════════════════════════════════════════════════

const BALL_RADIUS = 8;                 // 蓝/红球半径
const BALL_DIAMETER = BALL_RADIUS * 2; // 球直径 16px
const SOLDIER_RADIUS = 10;             // 军人稍大
const SHOOT_RANGE = BALL_DIAMETER * 15; // 15球直径 = 240px
const INFECT_FRAMES = 300;             // 5秒 (60fps)
const DOOR_WIDTH = 58;                  // 门宽
const WALL_T = 8;                       // 墙壁厚度

// 密室范围
const ROOM = { x1: 50, y1: 50, x2: 950, y2: 650 };
const CENTER_X = (ROOM.x1 + ROOM.x2) / 2;
const CENTER_Y = (ROOM.y1 + ROOM.y2) / 2;
const WALL_COLOR = '#4a5568';
const FLOOR_COLOR = '#1e293b';

// 室内障碍物（墙柱、拐角，增加地形复杂度）
const OBSTACLES = [
  // 左下方 L 形墙
  { x1: 120, y1: 400, x2: 300, y2: 408 },
  { x1: 292, y1: 400, x2: 300, y2: 520 },
  // 右上 L 形墙
  { x1: 680, y1: 150, x2: 850, y2: 158 },
  { x1: 842, y1: 150, x2: 850, y2: 270 },
  // 中央竖墙（不完全分隔）
  { x1: 480, y1: 180, x2: 488, y2: 330 },
  // 右下短墙组
  { x1: 780, y1: 520, x2: 900, y2: 528 },
  { x1: 780, y1: 520, x2: 788, y2: 580 },
  // 左上障碍
  { x1: 150, y1: 120, x2: 250, y2: 128 },
  { x1: 150, y1: 120, x2: 158, y2: 220 },
  // 散落柱体
  { x1: 380, y1: 300, x2: 388, y2: 320 },
  { x1: 600, y1: 400, x2: 620, y2: 408 },
  { x1: 350, y1: 550, x2: 368, y2: 558 },
  // 门附近矮墙（增加出门难度）
  { x1: 440, y1: 70,  x2: 448, y2: 150 },  // 上门口
  { x1: 552, y1: 70,  x2: 560, y2: 150 },
  { x1: 440, y1: 550, x2: 448, y2: 620 },  // 下门口
  { x1: 552, y1: 550, x2: 560, y2: 620 },
  { x1: 70,  y1: 330, x2: 140, y2: 338 },  // 左门口
  { x1: 70,  y1: 370, x2: 140, y2: 378 },
  { x1: 860, y1: 320, x2: 928, y2: 328 },  // 右门口
  { x1: 860, y1: 380, x2: 928, y2: 388 },
];

// 四扇门（分别在四面墙中间）
const DOORS = [
  // 上墙
  { x1: ROOM.x1 + (ROOM.x2-ROOM.x1)/2 - DOOR_WIDTH/2, y1: ROOM.y1 - WALL_T,
    x2: ROOM.x1 + (ROOM.x2-ROOM.x1)/2 + DOOR_WIDTH/2, y2: ROOM.y1,
    exitX: ROOM.x1 + (ROOM.x2-ROOM.x1)/2, exitY: ROOM.y1 - 40, side: 'top' },
  // 下墙
  { x1: ROOM.x1 + (ROOM.x2-ROOM.x1)/2 - DOOR_WIDTH/2, y1: ROOM.y2,
    x2: ROOM.x1 + (ROOM.x2-ROOM.x1)/2 + DOOR_WIDTH/2, y2: ROOM.y2 + WALL_T,
    exitX: ROOM.x1 + (ROOM.x2-ROOM.x1)/2, exitY: ROOM.y2 + 40, side: 'bottom' },
  // 左墙
  { x1: ROOM.x1 - WALL_T, y1: ROOM.y1 + (ROOM.y2-ROOM.y1)/2 - DOOR_WIDTH/2,
    x2: ROOM.x1, y2: ROOM.y1 + (ROOM.y2-ROOM.y1)/2 + DOOR_WIDTH/2,
    exitX: ROOM.x1 - 40, exitY: ROOM.y1 + (ROOM.y2-ROOM.y1)/2, side: 'left' },
  // 右墙
  { x1: ROOM.x2, y1: ROOM.y1 + (ROOM.y2-ROOM.y1)/2 - DOOR_WIDTH/2,
    x2: ROOM.x2 + WALL_T, y2: ROOM.y1 + (ROOM.y2-ROOM.y1)/2 + DOOR_WIDTH/2,
    exitX: ROOM.x2 + 40, exitY: ROOM.y1 + (ROOM.y2-ROOM.y1)/2, side: 'right' },
];

// 门中心点（用于检测球是否穿过门）
const DOOR_CENTERS = DOORS.map(d => ({
  x: (d.x1 + d.x2) / 2,
  y: (d.y1 + d.y2) / 2,
  side: d.side,
  exitX: d.exitX,
  exitY: d.exitY,
}));

// ═══════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════

function rand(min, max) { return Math.random() * (max - min) + min; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ═══════════════════════════════════════════════════════════════
//  游戏数据
// ═══════════════════════════════════════════════════════════════

let blueBalls = [];    // 蓝色幸存者
let redBalls = [];     // 红色丧尸
let whiteBalls = [];   // 白色军人
let savedCount = 0;
let gameRunning = true;

// 丧尸王（由玩家操控）
let boss = null;

// 键盘状态（WASD 操控丧尸王）
const bossKeys = {};
document.addEventListener('keydown', e => {
  bossKeys[e.key.toLowerCase()] = true;
  if (['w','a','s','d',' '].includes(e.key.toLowerCase())) e.preventDefault();
});
document.addEventListener('keyup', e => {
  bossKeys[e.key.toLowerCase()] = false;
});

// 感染队列：被丧尸接触的蓝球进入倒计时
// 每个感染项：{ ball, timer }
let infectedQueue = [];

// ═══════════════════════════════════════════════════════════════
//  初始化
// ═══════════════════════════════════════════════════════════════

const BOSS_RADIUS = 20;

function createBall(x, y, type) {
  return {
    x, y,
    vx: rand(-1.2, 1.2),
    vy: rand(-1.2, 1.2),
    type,       // 'blue' | 'red' | 'white'
    radius: type === 'white' ? SOLDIER_RADIUS : type === 'boss' ? BOSS_RADIUS : BALL_RADIUS,
    alive: true,
    infected: false,
    infectTimer: 0,
    saved: false,
    exitTimer: 0,       // 在门口停留计时（2秒=120帧后获救）
    // 射击相关（军人专用）
    shootCooldown: 0,
    shootFrame: 0,
    shootTarget: null,
    // 用于视觉差异化
    hueOffset: rand(0, 360),
  };
}

function initBalls() {
  blueBalls = [];
  redBalls = [];
  whiteBalls = [];
  infectedQueue = [];
  savedCount = 0;

  const margin = 20;
  const xRange = [ROOM.x1 + margin, ROOM.x2 - margin];
  const yRange = [ROOM.y1 + margin, ROOM.y2 - margin];

  // 100 个蓝球
  for (let i = 0; i < 100; i++) {
    const b = createBall(rand(...xRange), rand(...yRange), 'blue');
    blueBalls.push(b);
  }

  // 15 个红丧尸（初始在房间内随机位置）
  for (let i = 0; i < 15; i++) {
    const r = createBall(rand(...xRange), rand(...yRange), 'red');
    redBalls.push(r);
  }

  // 10 个白军人
  for (let i = 0; i < 10; i++) {
    // 军人在房间内靠中间分布
    const cx = (ROOM.x1 + ROOM.x2) / 2;
    const cy = (ROOM.y1 + ROOM.y2) / 2;
    const w = createBall(
      cx + rand(-150, 150),
      cy + rand(-150, 150),
      'white'
    );
    w.hp = 5;
    w.maxHp = 5;
    whiteBalls.push(w);
  }

  // 丧尸王（由玩家 WASD 操控）
  boss = createBall(CENTER_X, CENTER_Y, 'boss');
  boss.hp = 20;
  boss.maxHp = 20;
  boss.vx = 0;
  boss.vy = 0;
  boss.bossSpeed = 2.8;
}

// ═══════════════════════════════════════════════════════════════
//  碰撞检测
// ═══════════════════════════════════════════════════════════════

// 检测点是否在密室墙壁范围内（不包括门）
function hitWall(px, py, rad) {
  const r = rad || 0;
  // 上墙
  if (px + r > ROOM.x1 && px - r < ROOM.x2 &&
      py - r < ROOM.y1 && py + r > ROOM.y1 - WALL_T) {
    // 检查是否在门洞内
    const door = DOORS[0];
    if (px > door.x1 && px < door.x2) return false;
    return { side: 'top', wallY: ROOM.y1 };
  }
  // 下墙
  if (px + r > ROOM.x1 && px - r < ROOM.x2 &&
      py + r > ROOM.y2 && py - r < ROOM.y2 + WALL_T) {
    const door = DOORS[1];
    if (px > door.x1 && px < door.x2) return false;
    return { side: 'bottom', wallY: ROOM.y2 };
  }
  // 左墙
  if (py + r > ROOM.y1 && py - r < ROOM.y2 &&
      px - r < ROOM.x1 && px + r > ROOM.x1 - WALL_T) {
    const door = DOORS[2];
    if (py > door.y1 && py < door.y2) return false;
    return { side: 'left', wallX: ROOM.x1 };
  }
  // 右墙
  if (py + r > ROOM.y1 && py - r < ROOM.y2 &&
      px + r > ROOM.x2 && px - r < ROOM.x2 + WALL_T) {
    const door = DOORS[3];
    if (py > door.y1 && py < door.y2) return false;
    return { side: 'right', wallX: ROOM.x2 };
  }
  return false;
}

// 球与墙壁碰撞解析
function resolveWall(ball) {
  const hit = hitWall(ball.x, ball.y, ball.radius);
  if (hit) {
    if (hit.side === 'top')    { ball.y = ball.y - (ball.y + ball.radius - hit.wallY) - 1; ball.vy = -ball.vy * 0.5; }
    if (hit.side === 'bottom') { ball.y = ball.y - (ball.y - ball.radius - hit.wallY) + 1; ball.vy = -ball.vy * 0.5; }
    if (hit.side === 'left')   { ball.x = ball.x - (ball.x + ball.radius - hit.wallX) - 1; ball.vx = -ball.vx * 0.5; }
    if (hit.side === 'right')  { ball.x = ball.x - (ball.x - ball.radius - hit.wallX) + 1; ball.vx = -ball.vx * 0.5; }
    return true;
  }
  return false;
}

// 检测与室内障碍物的碰撞
function resolveObstacles(ball) {
  const r = ball.radius;
  for (const obs of OBSTACLES) {
    // 计算球到线段的最短距离
    const dx = obs.x2 - obs.x1, dy = obs.y2 - obs.y1;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) continue;
    let t = ((ball.x - obs.x1)*dx + (ball.y - obs.y1)*dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = obs.x1 + t * dx;
    const cy = obs.y1 + t * dy;
    const d = Math.hypot(ball.x - cx, ball.y - cy);
    if (d < r) {
      // 推离障碍物
      const nx = (ball.x - cx) / d || 0;
      const ny = (ball.y - cy) / d || 1;
      ball.x = cx + nx * r;
      ball.y = cy + ny * r;
      // 反弹减速
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= dot * 1.2 * nx;
        ball.vy -= dot * 1.2 * ny;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  蓝球 AI
// ═══════════════════════════════════════════════════════════════

function updateBlue(ball) {
  if (!ball.alive || ball.saved || ball.infected) return;

  // 1. 随机漫游（轻微布朗运动）
  ball.vx += rand(-0.08, 0.08);
  ball.vy += rand(-0.08, 0.08);

  // 2. 躲避附近的丧尸
  let dangerDir = { x: 0, y: 0 };
  for (const z of redBalls) {
    if (!z.alive) continue;
    const d = dist(ball, z);
    if (d < 120) {
      const force = (120 - d) / 120;
      dangerDir.x += (ball.x - z.x) / d * force * 0.5;
      dangerDir.y += (ball.y - z.y) / d * force * 0.5;
    }
  }
  ball.vx += dangerDir.x;
  ball.vy += dangerDir.y;

  // 3. 靠近门则朝门移动
  let nearestDoor = null;
  let nearDist = 180;
  for (const d of DOOR_CENTERS) {
    const dd = dist(ball, { x: d.x, y: d.y });
    if (dd < nearDist) {
      nearDist = dd;
      nearestDoor = d;
    }
  }
  if (nearestDoor) {
    const angle = Math.atan2(nearestDoor.y - ball.y, nearestDoor.x - ball.x);
    const pull = (180 - nearDist) / 180 * 0.3;
    ball.vx += Math.cos(angle) * pull;
    ball.vy += Math.sin(angle) * pull;
  }

  // 速度限制
  const spd = Math.hypot(ball.vx, ball.vy);
  const maxSpd = 1.8;
  if (spd > maxSpd) { ball.vx = ball.vx / spd * maxSpd; ball.vy = ball.vy / spd * maxSpd; }

  // 移动
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 墙壁碰撞 + 障碍物碰撞
  resolveWall(ball);
  resolveObstacles(ball);

  // 检查是否在门口
  let atDoor = false;
  for (const d of DOOR_CENTERS) {
    const inDoorway = (
      (d.side === 'top' && ball.y < ROOM.y1 + 5 && ball.x > d.x - DOOR_WIDTH/2 && ball.x < d.x + DOOR_WIDTH/2) ||
      (d.side === 'bottom' && ball.y > ROOM.y2 - 5 && ball.x > d.x - DOOR_WIDTH/2 && ball.x < d.x + DOOR_WIDTH/2) ||
      (d.side === 'left' && ball.x < ROOM.x1 + 5 && ball.y > d.y - DOOR_WIDTH/2 && ball.y < d.y + DOOR_WIDTH/2) ||
      (d.side === 'right' && ball.x > ROOM.x2 - 5 && ball.y > d.y - DOOR_WIDTH/2 && ball.y < d.y + DOOR_WIDTH/2)
    );
    if (inDoorway) {
      atDoor = true;
      ball.exitTimer++;
      // 2秒（120帧）后成功逃出
      if (ball.exitTimer >= 120) {
        ball.saved = true; ball.alive = false; savedCount++;
        return;
      }
      break;
    }
  }
  if (!atDoor) {
    ball.exitTimer = 0;  // 离开门口重置计时
  }

  // 房间边界防止逃逸（非门区域）
  ball.x = clamp(ball.x, ROOM.x1 + ball.radius, ROOM.x2 - ball.radius);
  ball.y = clamp(ball.y, ROOM.y1 + ball.radius, ROOM.y2 - ball.radius);
}

// ═══════════════════════════════════════════════════════════════
//  丧尸 AI
// ═══════════════════════════════════════════════════════════════

function updateRed(zombie) {
  if (!zombie.alive) return;

  // 追踪最近的蓝球
  let target = null;
  let minD = 400;
  for (const b of blueBalls) {
    if (!b.alive || b.saved || b.infected) continue;
    const d = dist(zombie, b);
    if (d < minD) { minD = d; target = b; }
  }

  if (target) {
    const angle = Math.atan2(target.y - zombie.y, target.x - zombie.x);
    zombie.vx += Math.cos(angle) * 0.15;
    zombie.vy += Math.sin(angle) * 0.15;
  } else {
    // 没有目标则随机游荡
    zombie.vx += rand(-0.05, 0.05);
    zombie.vy += rand(-0.05, 0.05);
  }

  // 丧尸速度比人快
  const spd = Math.hypot(zombie.vx, zombie.vy);
  const maxSpd = 2.5;
  if (spd > maxSpd) { zombie.vx /= spd * maxSpd; zombie.vy /= spd * maxSpd; }

  zombie.x += zombie.vx;
  zombie.y += zombie.vy;
  resolveWall(zombie);
  resolveObstacles(zombie);
  zombie.x = clamp(zombie.x, ROOM.x1 + zombie.radius, ROOM.x2 - zombie.radius);
  zombie.y = clamp(zombie.y, ROOM.y1 + zombie.radius, ROOM.y2 - zombie.radius);

  // 接触蓝球 → 感染
  for (const b of blueBalls) {
    if (!b.alive || b.saved || b.infected) continue;
    if (dist(zombie, b) < zombie.radius + b.radius) {
      b.infected = true;
      b.infectTimer = INFECT_FRAMES;
      // 推开避免黏连
      const angle = Math.atan2(b.y - zombie.y, b.x - zombie.x);
      b.x += Math.cos(angle) * 3;
      b.y += Math.sin(angle) * 3;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  军人 AI
// ═══════════════════════════════════════════════════════════════

function updateWhite(soldier) {
  if (!soldier.alive) return;

  // 找最近的敌人（普通丧尸优先，其次是丧尸王）
  let target = null;
  let minD = 500;
  // 先找普通丧尸
  for (const z of redBalls) {
    if (!z.alive) continue;
    const d = dist(soldier, z);
    if (d < minD) { minD = d; target = z; target.isBoss = false; }
  }
  // 再考虑丧尸王（即使远也设为目标，避免 target 为 null）
  if (boss && boss.alive) {
    const d = dist(soldier, boss);
    if (d < minD || !target) { minD = d; target = boss; target.isBoss = true; }
  }

  if (target) {
    const d = dist(soldier, target);

    // 在射程内 → 开枪（有 2 秒冷却）
    if (d < SHOOT_RANGE && soldier.shootCooldown <= 0) {
      if (target.isBoss) {
        // 打丧尸王：扣 1 HP
        target.hp--;
        if (target.hp <= 0) target.alive = false;
      } else {
        target.alive = false;  // 普通丧尸一枪击杀
      }
      soldier.shootCooldown = 120;  // 2秒冷却 (60fps)
      // 开枪特效（后面绘制）
      soldier.shootFrame = 10;
      soldier.shootTarget = { x: target.x, y: target.y };
    } else {
      // 追向最近的敌人
      const angle = Math.atan2(target.y - soldier.y, target.x - soldier.x);
      soldier.vx += Math.cos(angle) * 0.08;
      soldier.vy += Math.sin(angle) * 0.08;
    }
  } else {
    // 没敌人了，巡逻
    soldier.vx += rand(-0.03, 0.03);
    soldier.vy += rand(-0.03, 0.03);
  }

  // 速度限制
  const spd = Math.hypot(soldier.vx, soldier.vy);
  const maxSpd = 2.2;
  if (spd > maxSpd) { soldier.vx /= spd * maxSpd; soldier.vy /= spd * maxSpd; }

  soldier.x += soldier.vx;
  soldier.y += soldier.vy;
  resolveWall(soldier);
  resolveObstacles(soldier);
  soldier.x = clamp(soldier.x, ROOM.x1 + soldier.radius, ROOM.x2 - soldier.radius);
  soldier.y = clamp(soldier.y, ROOM.y1 + soldier.radius, ROOM.y2 - soldier.radius);

  // 开枪冷却和特效计时
  if (soldier.shootFrame > 0) soldier.shootFrame--;
  if (soldier.shootCooldown > 0) soldier.shootCooldown--;
}

// ═══════════════════════════════════════════════════════════════
//  丧尸王 AI（玩家 WASD 操控）
// ═══════════════════════════════════════════════════════════════

function updateBoss() {
  if (!boss || !boss.alive) return;

  let mx = 0, my = 0;
  if (bossKeys['w']) my = -1;
  if (bossKeys['s']) my = 1;
  if (bossKeys['a']) mx = -1;
  if (bossKeys['d']) mx = 1;

  // 归一化八方向
  if (mx !== 0 && my !== 0) {
    const len = Math.sqrt(mx*mx + my*my);
    mx /= len; my /= len;
  }

  boss.vx = mx * boss.bossSpeed;
  boss.vy = my * boss.bossSpeed;

  boss.x += boss.vx;
  boss.y += boss.vy;
  resolveWall(boss);
  resolveObstacles(boss);
  boss.x = clamp(boss.x, ROOM.x1 + boss.radius, ROOM.x2 - boss.radius);
  boss.y = clamp(boss.y, ROOM.y1 + boss.radius, ROOM.y2 - boss.radius);

  // 丧尸王碰到蓝球 → 立刻变丧尸
  for (const b of blueBalls) {
    if (!b.alive || b.saved || b.infected) continue;
    if (dist(boss, b) < boss.radius + b.radius) {
      b.infected = true;
      b.infectTimer = 1;  // 下一帧立刻变丧尸
      // 推开
      const angle = Math.atan2(b.y - boss.y, b.x - boss.x);
      b.x += Math.cos(angle) * 5;
      b.y += Math.sin(angle) * 5;
    }
  }

  // 丧尸王碰到军人 → 扣 1 HP，传送到随机位置
  for (const w of whiteBalls) {
    if (!w.alive) continue;
    if (dist(boss, w) < boss.radius + w.radius) {
      w.hp--;
      if (w.hp <= 0) {
        w.alive = false;  // HP 归零死亡
      } else {
        // 传送到房间内随机位置
        const margin = 30;
        w.x = rand(ROOM.x1 + margin, ROOM.x2 - margin);
        w.y = rand(ROOM.y1 + margin, ROOM.y2 - margin);
        w.vx = 0;
        w.vy = 0;
        // 清除瞄准状态
        w.shootTarget = null;
        w.shootFrame = 0;
      }
      // 推开
      const angle = Math.atan2(w.y - boss.y, w.x - boss.x);
      w.x += Math.cos(angle) * 8;
      w.y += Math.sin(angle) * 8;
    }
  }

  // 丧尸王碰到普通丧尸 → 推开（友好碰撞）
  for (const z of redBalls) {
    if (!z.alive) continue;
    const d = dist(boss, z);
    const minD = boss.radius + z.radius;
    if (d < minD && d > 0) {
      const nx = (boss.x - z.x) / d;
      const ny = (boss.y - z.y) / d;
      z.x -= nx * 3;
      z.y -= ny * 3;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  球-球碰撞
// ═══════════════════════════════════════════════════════════════

function resolveBallCollisions() {
  const all = [...blueBalls.filter(b => b.alive && !b.saved),
               ...redBalls.filter(r => r.alive),
               ...whiteBalls.filter(w => w.alive)];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const d = dist(a, b);
      const minD = a.radius + b.radius;
      if (d < minD && d > 0) {
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        const overlap = minD - d;
        // 同类型质量相同，军人更重
        const massA = a.type === 'white' ? 1.5 : 1;
        const massB = b.type === 'white' ? 1.5 : 1;
        const total = massA + massB;
        const push = overlap * 0.5;
        a.x += nx * push * (massB / total);
        a.y += ny * push * (massB / total);
        b.x -= nx * push * (massA / total);
        b.y -= ny * push * (massA / total);
        // 轻微反弹
        const relVx = a.vx - b.vx;
        const relVy = a.vy - b.vy;
        const dot = relVx * nx + relVy * ny;
        if (dot < 0) {
          a.vx -= dot * 0.2 * nx;
          a.vy -= dot * 0.2 * ny;
          b.vx += dot * 0.2 * nx;
          b.vy += dot * 0.2 * ny;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  感染队列更新
// ═══════════════════════════════════════════════════════════════

function updateInfections() {
  const toRemove = [];
  for (const item of infectedQueue) {
    item.timer--;
    // 感染中的蓝球视觉变化在绘制时处理
    if (item.timer <= 0) {
      // 变为丧尸！
      const ball = item.ball;
      ball.alive = false;  // 从蓝队移除
      // 创建新丧尸
      const z = createBall(ball.x, ball.y, 'red');
      z.vx = rand(-1, 1);
      z.vy = rand(-1, 1);
      redBalls.push(z);
      toRemove.push(item);
    }
  }
  // 移除已完成的感染项
  for (const item of toRemove) {
    const idx = infectedQueue.indexOf(item);
    if (idx >= 0) infectedQueue.splice(idx, 1);
  }

  // 新感染检查（有 infectTimer 的蓝球且不在队列中）
  for (const b of blueBalls) {
    if (b.infected && b.alive && !b.saved) {
      const inQueue = infectedQueue.some(item => item.ball === b);
      if (!inQueue) {
        infectedQueue.push({ ball: b, timer: b.infectTimer });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  绘制
// ═══════════════════════════════════════════════════════════════

function draw() {
  ctx.clearRect(0, 0, W, H);

  // ── 密室地板 ──
  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(ROOM.x1, ROOM.y1, ROOM.x2 - ROOM.x1, ROOM.y2 - ROOM.y1);

  // 地板网格
  ctx.strokeStyle = 'rgba(255,255,255,.03)';
  ctx.lineWidth = 0.5;
  for (let x = ROOM.x1; x <= ROOM.x2; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, ROOM.y1); ctx.lineTo(x, ROOM.y2); ctx.stroke();
  }
  for (let y = ROOM.y1; y <= ROOM.y2; y += 30) {
    ctx.beginPath(); ctx.moveTo(ROOM.x1, y); ctx.lineTo(ROOM.x2, y); ctx.stroke();
  }

  // ── 墙壁 + 门 ──
  ctx.fillStyle = WALL_COLOR;
  // 上墙（门洞留空）
  ctx.fillRect(ROOM.x1, ROOM.y1 - WALL_T, DOORS[0].x1 - ROOM.x1, WALL_T);
  ctx.fillRect(DOORS[0].x2, ROOM.y1 - WALL_T, ROOM.x2 - DOORS[0].x2, WALL_T);
  // 下墙
  ctx.fillRect(ROOM.x1, ROOM.y2, DOORS[1].x1 - ROOM.x1, WALL_T);
  ctx.fillRect(DOORS[1].x2, ROOM.y2, ROOM.x2 - DOORS[1].x2, WALL_T);
  // 左墙
  ctx.fillRect(ROOM.x1 - WALL_T, ROOM.y1, WALL_T, DOORS[2].y1 - ROOM.y1);
  ctx.fillRect(ROOM.x1 - WALL_T, DOORS[2].y2, WALL_T, ROOM.y2 - DOORS[2].y2);
  // 右墙
  ctx.fillRect(ROOM.x2, ROOM.y1, WALL_T, DOORS[3].y1 - ROOM.y1);
  ctx.fillRect(ROOM.x2, DOORS[3].y2, WALL_T, ROOM.y2 - DOORS[3].y2);
  // 墙角装饰
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ROOM.x1, ROOM.y1, ROOM.x2 - ROOM.x1, ROOM.y2 - ROOM.y1);

  // ── 门（发光出口） ──
  for (const d of DOORS) {
    const cx = (d.x1 + d.x2) / 2, cy = (d.y1 + d.y2) / 2;
    const w = d.x2 - d.x1, hh = d.y2 - d.y1;
    // 光晕
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40);
    glow.addColorStop(0, 'rgba(81, 207, 102, .35)');
    glow.addColorStop(1, 'rgba(81, 207, 102, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 40, cy - 40, 80, 80);
    // 门框
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(d.x1, d.y1, w, Math.max(hh, 1));
    // 箭头
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arrow = d.side === 'top' ? '↑' : d.side === 'bottom' ? '↓' : d.side === 'left' ? '←' : '→';
    ctx.fillText('出口' + arrow, cx, cy);
  }

  // ── 室内障碍物 ──
  ctx.fillStyle = '#5a4a3a';
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = 6;
  for (const obs of OBSTACLES) {
    const w = Math.abs(obs.x2 - obs.x1) || 4;
    const h = Math.abs(obs.y2 - obs.y1) || 4;
    ctx.fillRect(Math.min(obs.x1, obs.x2), Math.min(obs.y1, obs.y2),
                 Math.max(w, 6), Math.max(h, 6));
  }
  ctx.shadowBlur = 0;
  // 障碍物顶部高光线
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  for (const obs of OBSTACLES) {
    ctx.beginPath();
    ctx.moveTo(obs.x1, obs.y1);
    ctx.lineTo(obs.x2, obs.y2);
    ctx.stroke();
  }

  // ── 丧尸王射程圈 ──
  if (boss && boss.alive) {
    ctx.strokeStyle = 'rgba(200, 50, 50, .15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, SHOOT_RANGE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── 军人射程圈 ──
  for (const w of whiteBalls) {
    if (!w.alive) continue;
    ctx.strokeStyle = 'rgba(222, 226, 230, .1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(w.x, w.y, SHOOT_RANGE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── 蓝球（幸存者） ──
  for (const b of blueBalls) {
    if (!b.alive || b.saved) continue;
    const r = b.radius;

    ctx.shadowColor = 'rgba(77, 171, 247, .2)';
    ctx.shadowBlur = 6;

    if (b.infected) {
      // 被感染倒计时中：闪烁绿色
      const flash = Math.sin(Date.now() / 80 + b.hueOffset) * 0.3 + 0.5;
      ctx.fillStyle = `rgba(${100 + 155 * flash}, ${180 * flash}, ${80 * flash}, .9)`;
    } else {
      ctx.fillStyle = '#4dabf7';
    }

    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.arc(b.x - 2, b.y - 2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 红球（丧尸） ──
  for (const z of redBalls) {
    if (!z.alive) continue;
    ctx.shadowColor = 'rgba(255, 50, 50, .4)';
    ctx.shadowBlur = 12;

    const grad = ctx.createRadialGradient(z.x - 2, z.y - 2, 1, z.x, z.y, z.radius);
    grad.addColorStop(0, '#ff6b6b');
    grad.addColorStop(0.7, '#e03131');
    grad.addColorStop(1, '#c92a2a');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 丧尸"眼睛"（两个小白点）
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.arc(z.x - 2.5, z.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(z.x + 2.5, z.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    // 瞳孔
    ctx.fillStyle = '#c92a2a';
    ctx.beginPath();
    ctx.arc(z.x - 2.5, z.y - 1.5, 1, 0, Math.PI * 2);
    ctx.arc(z.x + 2.5, z.y - 1.5, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 白球（军人） ──
  for (const w of whiteBalls) {
    if (!w.alive) continue;
    ctx.shadowColor = 'rgba(200, 200, 220, .3)';
    ctx.shadowBlur = 10;

    const grad = ctx.createRadialGradient(w.x - 2, w.y - 2, 1, w.x, w.y, w.radius);
    grad.addColorStop(0, '#f8f9fa');
    grad.addColorStop(0.6, '#dee2e6');
    grad.addColorStop(1, '#adb5bd');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 军人血量指示器
    if (w.hp !== undefined) {
      const hpW = 16, hpH = 3;
      const hx = w.x - hpW/2, hy = w.y + w.radius + 5;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(hx - 1, hy - 1, hpW + 2, hpH + 2);
      ctx.fillStyle = w.hp > 2 ? '#51cf66' : w.hp > 1 ? '#ffd43b' : '#ff6b6b';
      ctx.fillRect(hx, hy, hpW * (w.hp / w.maxHp), hpH);
    }

    // 军人标记 - 准星
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w.x - 3, w.y); ctx.lineTo(w.x + 3, w.y);
    ctx.moveTo(w.x, w.y - 3); ctx.lineTo(w.x, w.y + 3);
    ctx.stroke();

    // 开枪特效
    if (w.shootFrame && w.shootFrame > 0 && w.shootTarget) {
      ctx.strokeStyle = `rgba(255, 230, 100, ${w.shootFrame / 12})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.shootTarget.x, w.shootTarget.y);
      ctx.stroke();
      // 枪口火焰
      ctx.fillStyle = `rgba(255, 200, 50, ${w.shootFrame / 10})`;
      ctx.beginPath();
      ctx.arc(w.shootTarget.x, w.shootTarget.y, 5 + w.shootFrame, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 丧尸王 ──
  if (boss && boss.alive) {
    const r = boss.radius;
    // 巨大阴影
    ctx.shadowColor = 'rgba(180, 20, 20, .5)';
    ctx.shadowBlur = 25;

    const grad = ctx.createRadialGradient(boss.x - 4, boss.y - 4, 2, boss.x, boss.y, r);
    grad.addColorStop(0, '#ff2222');
    grad.addColorStop(0.5, '#cc0000');
    grad.addColorStop(1, '#660000');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 丧尸王眼睛（凶狠红色）
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(boss.x - 5, boss.y - 4, 4, 0, Math.PI * 2);
    ctx.arc(boss.x + 5, boss.y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(boss.x - 5, boss.y - 3, 2, 0, Math.PI * 2);
    ctx.arc(boss.x + 5, boss.y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    // 血盆大口
    ctx.fillStyle = '#440000';
    ctx.beginPath();
    ctx.arc(boss.x, boss.y + 5, 6, 0, Math.PI);
    ctx.fill();

    // 血条
    const barW = 40, barH = 5;
    const bx = boss.x - barW/2, by = boss.y - r - 12;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    const hpRatio = boss.hp / boss.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#51cf66' : hpRatio > 0.25 ? '#ffd43b' : '#ff6b6b';
    ctx.fillRect(bx, by, barW * hpRatio, barH);
    // HP 数字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`👑 ${boss.hp}/${boss.maxHp}`, boss.x, by - 4);
  }

  // ── 感染倒计时（显示在被感染球旁边） ──
  for (const item of infectedQueue) {
    const b = item.ball;
    if (!b.alive) continue;
    const secs = Math.ceil(item.timer / 60);
    ctx.fillStyle = 'rgba(255, 200, 50, .8)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${secs}s`, b.x, b.y - b.radius - 8);
  }

  // ── 门口逃出进度条 ──
  for (const b of blueBalls) {
    if (!b.alive || b.saved || b.exitTimer <= 0) continue;
    const prog = b.exitTimer / 120;
    const bx = b.x, by = b.y + b.radius + 8;
    // 背景
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(bx - 12, by - 2, 24, 5);
    // 进度
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(bx - 11, by - 1, 22 * prog, 3);
  }

  // ── 顶部信息 ──
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fillRect(0, 0, W, 30);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  const aliveBlue = blueBalls.filter(b => b.alive && !b.saved && !b.infected).length;
  const infected = blueBalls.filter(b => b.infected && b.alive).length;
  ctx.fillText(`🧟 丧尸捉人模拟器  ·  幸存 ${aliveBlue}  感染中 ${infected}  已获救 ${savedCount}  ` +
               `丧尸 ${redBalls.filter(z=>z.alive).length}  军人 ${whiteBalls.filter(w=>w.alive).length}`, W/2, 20);

  // ── 更新 HUD ──
  document.getElementById('countBlue').textContent = aliveBlue;
  document.getElementById('countRed').textContent = redBalls.filter(z => z.alive).length;
  document.getElementById('countWhite').textContent = whiteBalls.filter(w => w.alive).length;
  document.getElementById('countSaved').textContent = savedCount;
}

// ═══════════════════════════════════════════════════════════════
//  主循环
// ═══════════════════════════════════════════════════════════════

function update() {
  if (!gameRunning) return;

  // 1. 更新蓝球（人）
  for (const b of blueBalls) {
    if (b.alive && !b.saved) updateBlue(b);
  }

  // 2. 更新红球（丧尸）
  for (const z of redBalls) {
    if (z.alive) updateRed(z);
  }

  // 3. 更新白球（军人）
  for (const w of whiteBalls) {
    if (w.alive) updateWhite(w);
  }

  // 3.5 更新丧尸王（玩家操控）
  if (boss && boss.alive) updateBoss();

  // 4. 球-球碰撞
  resolveBallCollisions();

  // 5. 感染队列
  updateInfections();

  // 6. 补充丧尸（如果被军人杀光了，从感染队列补）
  if (redBalls.filter(z => z.alive).length === 0 && blueBalls.some(b => b.infected && b.alive)) {
    // 让最快的感染变丧尸
    let fastest = null;
    for (const item of infectedQueue) {
      if (item.ball.alive && (!fastest || item.timer < fastest.timer)) {
        fastest = item;
      }
    }
    if (fastest) {
      fastest.timer = 1; // 下一帧变丧尸
    }
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════
//  重置
// ═══════════════════════════════════════════════════════════════

function resetSim() {
  // 清除旧数据确保重置
  blueBalls = [];
  redBalls = [];
  whiteBalls = [];
  infectedQueue = [];
  savedCount = 0;
  boss = null;
  initBalls();
}

// ═══════════════════════════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════════════════════════

initBalls();
loop();

// 重置按钮（用事件监听替代内联 onclick，规避 CSP 限制）
document.getElementById('resetBtn').addEventListener('click', resetSim);
