"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WORLD_1_2_BONUS_COINS,
  WORLD_1_2_BONUS_MULTICOIN_BLOCK,
  WORLD_1_2_GOOMBAS,
  WORLD_1_2_KOOPAS,
  WORLD_1_2_LOOSE_COINS,
  WORLD_1_2_MAP,
  WORLD_1_2_MOVING_PLATFORMS,
  WORLD_1_2_PIPES,
  WORLD_1_2_QUESTION_BLOCKS,
  WORLD_1_2_REWARD_BLOCKS,
  WORLD_1_2_STATIC_RUNS,
  getWorld12Transition,
} from "./world-1-2-data.mjs";

const TILE = 48;
const VIEW_W = TILE * 16;
const VIEW_H = TILE * 15;
const FLOOR_Y = TILE * 13;
const PLAYER_WIDTH = 42;
const PLAYER_HEIGHT = TILE;

type Phase = "start" | "playing" | "paused" | "cleared" | "won" | "lost";
type Character = "mario" | "wangjian";
type Theme = "overworld" | "underground" | "athletic" | "castle";
type SolidKind = "ground" | "brick" | "question" | "pipe" | "sidePipe" | "step" | "platform" | "tree" | "castle";
type RewardKind = "coin" | "multiCoin" | "mushroom" | "star" | "oneUp";
type EnemyKind = "goomba" | "koopa" | "redkoopa" | "parakoopa" | "piranha" | "bowser";

type Box = { x: number; y: number; w: number; h: number };
type Solid = Box & {
  id: string;
  kind: SolidKind;
  reward?: RewardKind;
  used?: boolean;
  bump?: number;
  hits?: number;
  originY?: number;
  motion?: "vertical";
  phase?: number;
  travelRows?: number;
  hidden?: boolean;
};
type Coin = Box & { id: string; taken: boolean; phase: number };
type Enemy = Box & {
  id: string;
  kind: EnemyKind;
  vx: number;
  vy: number;
  dead: boolean;
  squish: number;
  originY?: number;
  phase?: number;
};
type Hazard = Box & {
  id: string;
  kind: "lava" | "firebar";
  length?: number;
  direction?: 1 | -1;
  speed?: number;
};
type PowerupKind = "mushroom" | "star" | "oneUp";
type Powerup = Box & { id: string; kind: PowerupKind; vx: number; vy: number; active: boolean };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  text?: string;
};
type Player = Box & {
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  coyote: number;
  jumpBuffer: number;
  runFrame: number;
  powered: boolean;
  invuln: number;
  starTimer: number;
};
type World = {
  index: number;
  label: string;
  theme: Theme;
  surfaceStart?: number;
  width: number;
  goalX: number;
  castleX?: number;
  startCastleX?: number;
  solids: Solid[];
  coins: Coin[];
  enemies: Enemy[];
  hazards: Hazard[];
  powerups: Powerup[];
  particles: Particle[];
  time: number;
  score: number;
  coinCount: number;
  lives: number;
  cameraX: number;
  elapsed: number;
  area: "entry" | "main" | "bonus" | "exit";
  pipeCooldown: number;
  finishState: "none" | "pole" | "walk" | "castleFlag";
  finishTimer: number;
  character: Character;
  qaLastEvent?: string;
};
type Controls = { left: boolean; right: boolean; down: boolean; jump: boolean; run: boolean };
type Stats = { score: number; coinCount: number; lives: number };

const levelNames = ["WORLD 1–1", "WORLD 1–2", "WORLD 1–3", "WORLD 1–4"];
const WORLD_1_2_MAIN_START = WORLD_1_2_MAP.mainStart;
const WORLD_1_2_ENTRY_PIPE = WORLD_1_2_MAIN_START + WORLD_1_2_MAP.bonusEntryPipe;
const WORLD_1_2_RETURN_PIPE = WORLD_1_2_MAIN_START + WORLD_1_2_MAP.bonusReturnPipe;
const WORLD_1_2_MAIN_EXIT = WORLD_1_2_MAIN_START + WORLD_1_2_MAP.normalExitPipe;
const WORLD_1_2_EXIT_START = WORLD_1_2_MAP.exitStart;
const WORLD_1_2_BONUS_START = WORLD_1_2_MAP.bonusStart;
const WORLD_1_2_BONUS_EXIT = WORLD_1_2_BONUS_START + WORLD_1_2_MAP.bonusExitPipe;

const initialPlayer = (): Player => ({
  x: TILE * 3,
  y: FLOOR_Y - PLAYER_HEIGHT,
  w: PLAYER_WIDTH,
  h: PLAYER_HEIGHT,
  vx: 0,
  vy: 0,
  grounded: false,
  facing: 1,
  coyote: 0,
  jumpBuffer: 0,
  runFrame: 0,
  powered: false,
  invuln: 0,
  starTimer: 0,
});

const makeSolid = (
  id: string,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  kind: SolidKind,
  reward?: RewardKind,
): Solid => ({ id, x: tx * TILE, y: ty * TILE, w: tw * TILE, h: th * TILE, kind, reward });

const makeCoin = (id: string, tx: number, ty: number, phase = 0): Coin => ({
  id,
  x: tx * TILE + 14,
  y: ty * TILE + 8,
  w: 20,
  h: 32,
  taken: false,
  phase,
});

const makeEnemy = (id: string, kind: EnemyKind, tx: number, topRow = 13, direction: 1 | -1 = -1): Enemy => {
  const h = kind === "goomba" ? 40 : kind === "piranha" ? 48 : kind === "bowser" ? 92 : 54;
  const w = kind === "piranha" ? 34 : kind === "bowser" ? 88 : 42;
  const originY = kind === "piranha" ? topRow * TILE + 14 : undefined;
  return {
    id,
    kind,
    x: tx * TILE + (kind === "piranha" ? TILE - w / 2 : 3),
    y: originY ?? topRow * TILE - h,
    w,
    h,
    vx: kind === "piranha" ? 0 : (kind === "bowser" ? 34 : 62) * direction,
    vy: 0,
    dead: false,
    squish: 0,
    originY,
    phase: tx * 0.37,
  };
};

const addGround = (solids: Solid[], id: string, start: number, end: number, kind: SolidKind = "ground") => {
  solids.push(makeSolid(id, start, 13, end - start + 1, 2, kind));
};

const addPipe = (solids: Solid[], id: string, tx: number, topRow: number) => {
  solids.push(makeSolid(id, tx, topRow, 2, 13 - topRow, "pipe"));
};

const addSidePipe = (solids: Solid[], id: string, tx: number, topRow: number) => {
  solids.push(makeSolid(id, tx, topRow, 3, 2, "sidePipe"));
};

function makeWorld1_1(stats: Stats, character: Character): World {
  const solids: Solid[] = [];
  addGround(solids, "g-a", 0, 68);
  addGround(solids, "g-b", 71, 85);
  addGround(solids, "g-c", 89, 152);
  addGround(solids, "g-d", 155, 223);

  const questions: Array<[number, number, "coin" | "mushroom"]> = [
    [16, 9, "coin"], [21, 9, "mushroom"], [22, 5, "coin"], [23, 9, "coin"],
    [78, 9, "coin"], [94, 5, "coin"], [106, 9, "coin"], [109, 9, "mushroom"],
    [109, 5, "mushroom"], [112, 9, "coin"], [129, 5, "coin"], [130, 5, "coin"],
    [170, 9, "coin"],
  ];
  questions.forEach(([x, y, reward], i) => solids.push(makeSolid(`q-${i}`, x, y, 1, 1, "question", reward)));

  const bricks: Array<[number, number, "coin"?]> = [
    [20, 9], [22, 9], [24, 9], [77, 9], [79, 9], [80, 5], [81, 5], [82, 5],
    [83, 5], [84, 5], [85, 5], [86, 5], [87, 5], [91, 5], [92, 5], [93, 5],
    [94, 9, "coin"], [100, 9], [118, 9], [121, 5], [122, 5], [123, 5], [128, 5], [131, 5],
    [129, 9], [130, 9], [168, 9], [169, 9], [171, 9],
  ];
  bricks.forEach(([x, y, reward], i) => solids.push(makeSolid(`b-${i}`, x, y, 1, 1, "brick", reward)));

  addPipe(solids, "pipe-1", 28, 11);
  addPipe(solids, "pipe-2", 38, 10);
  addPipe(solids, "pipe-3", 46, 9);
  addPipe(solids, "pipe-4", 57, 9);
  addPipe(solids, "pipe-5", 163, 11);
  addPipe(solids, "pipe-6", 179, 11);

  const steps = (prefix: string, start: number, heights: number[]) => heights.forEach((height, i) => {
    solids.push(makeSolid(`${prefix}-${i}`, start + i, 13 - height, 1, height, "step"));
  });
  steps("stair-a", 134, [1, 2, 3, 4]);
  steps("stair-b", 140, [4, 3, 2, 1]);
  steps("stair-c", 148, [1, 2, 3, 4]);
  steps("stair-d", 155, [4, 4, 3, 2, 1]);
  steps("stair-goal", 181, [1, 2, 3, 4, 5, 6, 7, 8, 8]);

  const enemies = [22, 40, 80, 82, 124, 128, 174, 176].map((x, i) => makeEnemy(`goomba-${i}`, "goomba", x));
  enemies.push(makeEnemy("koopa-1", "koopa", 107));

  return {
    index: 0,
    label: levelNames[0],
    theme: "overworld",
    width: 224 * TILE,
    goalX: 198 * TILE,
    castleX: 202 * TILE,
    solids,
    coins: [],
    enemies,
    hazards: [],
    powerups: [],
    particles: [],
    time: 400,
    ...stats,
    cameraX: 0,
    elapsed: 0,
    area: "main",
    pipeCooldown: 0,
    finishState: "none",
    finishTimer: 0,
    character,
  };
}

function makeWorld1_2(stats: Stats, character: Character): World {
  const solids: Solid[] = [];
  const underground = (sourceTile: number) => WORLD_1_2_MAIN_START + sourceTile;

  // Original 1-2 opens on the surface, then drops the player through the ceiling.
  addGround(solids, "entry-ground", 0, 15);
  addPipe(solids, "entry-down-pipe", WORLD_1_2_MAP.entryPipe, 10);

  WORLD_1_2_STATIC_RUNS.forEach(([row, runs]) => {
    runs.forEach(([start, end]) => {
      solids.push(makeSolid(`ug-static-${row}-${start}`, underground(start), row, end - start + 1, 1, "castle"));
    });
  });

  WORLD_1_2_QUESTION_BLOCKS.forEach((block, index) => {
    solids.push(makeSolid(`ug-question-${index}`, underground(block.x), block.y, 1, 1, "question", block.reward as RewardKind));
  });
  WORLD_1_2_REWARD_BLOCKS.forEach((block) => {
    const solid = makeSolid(`ug-${block.id}`, underground(block.x), block.y, 1, 1, "brick", block.reward as RewardKind);
    solid.hidden = Boolean(block.hidden);
    solids.push(solid);
  });

  WORLD_1_2_PIPES.forEach((pipe) => addPipe(solids, `ug-${pipe.id}`, underground(pipe.x), pipe.top));
  WORLD_1_2_MOVING_PLATFORMS.forEach((platform) => {
    const solid = makeSolid(`ug-${platform.id}`, underground(platform.x), platform.top, platform.width, 0.35, "platform");
    solid.originY = platform.top * TILE;
    solid.motion = "vertical";
    solid.phase = platform.phase;
    solid.travelRows = platform.bottom - platform.top;
    solids.push(solid);
  });
  addSidePipe(solids, "ug-normal-exit", WORLD_1_2_MAIN_EXIT, 8);

  // Coin room: 17 loose coins plus one ten-coin brick = the original 27-coin route.
  addGround(solids, "bonus-floor", WORLD_1_2_BONUS_START, WORLD_1_2_BONUS_START + 15, "castle");
  solids.push(makeSolid("bonus-ceiling", WORLD_1_2_BONUS_START, 2, 16, 1, "castle"));
  solids.push(makeSolid("bonus-left-wall", WORLD_1_2_BONUS_START, 2, 1, 11, "castle"));
  solids.push(makeSolid("bonus-right-wall", WORLD_1_2_BONUS_START + 15, 2, 1, 11, "castle"));
  solids.push(makeSolid("bonus-ten-coin", WORLD_1_2_BONUS_START + WORLD_1_2_BONUS_MULTICOIN_BLOCK.x, WORLD_1_2_BONUS_MULTICOIN_BLOCK.y, 1, 1, "brick", "multiCoin"));
  addPipe(solids, "bonus-exit-pipe", WORLD_1_2_BONUS_EXIT, 9);

  // Normal pipe exit, staircase, flagpole and castle.
  addGround(solids, "exit-ground", WORLD_1_2_EXIT_START, WORLD_1_2_EXIT_START + 36);
  addPipe(solids, "exit-up-pipe", WORLD_1_2_EXIT_START + 3, 11);
  [1, 2, 3, 4, 5, 6, 7, 8, 8].forEach((height, i) => {
    solids.push(makeSolid(`exit-step-${i}`, WORLD_1_2_EXIT_START + 7 + i, 13 - height, 1, height, "step"));
  });

  const coins: Coin[] = WORLD_1_2_LOOSE_COINS.map(([x, y], index) => makeCoin(`ug-coin-${index}`, underground(x), y, index * 0.17));
  WORLD_1_2_BONUS_COINS.forEach(([x, y], index) => coins.push(makeCoin(`bonus-coin-${index}`, WORLD_1_2_BONUS_START + x, y, index * 0.23)));

  const enemies: Enemy[] = WORLD_1_2_GOOMBAS.map((enemy, index) => makeEnemy(`ug-goomba-${index}`, "goomba", underground(enemy.x), enemy.top));
  WORLD_1_2_KOOPAS.forEach((enemy, index) => enemies.push(makeEnemy(`ug-koopa-${index}`, enemy.kind as EnemyKind, underground(enemy.x), enemy.top)));

  return {
    index: 1,
    label: levelNames[1],
    theme: "underground",
    width: (WORLD_1_2_BONUS_START + 16) * TILE,
    goalX: (WORLD_1_2_EXIT_START + 20) * TILE,
    castleX: (WORLD_1_2_EXIT_START + 24) * TILE,
    startCastleX: -2 * TILE,
    solids,
    coins,
    enemies,
    hazards: [],
    powerups: [],
    particles: [],
    time: 400,
    ...stats,
    cameraX: 0,
    elapsed: 0,
    area: "entry",
    pipeCooldown: 0,
    finishState: "none",
    finishTimer: 0,
    character,
  };
}

function makeWorld1_3(stats: Stats, character: Character): World {
  const solids: Solid[] = [];
  addGround(solids, "start", 0, 15);
  addGround(solids, "finish", 138, 175);
  const platforms: Array<[number, number, number]> = [
    [20, 11, 4], [27, 8, 4], [31, 4, 5], [36, 10, 2], [40, 7, 7], [50, 6, 4],
    [59, 9, 4], [65, 5, 6], [76, 8, 6], [83, 4, 5], [93, 10, 4], [98, 7, 5],
    [104, 10, 3], [113, 8, 5], [120, 4, 8], [132, 11, 4],
  ];
  platforms.forEach(([x, y, w], i) => solids.push(makeSolid(`tree-${i}`, x, y, w, 1, "tree")));
  [[54, 6, 2], [88, 6, 2], [108, 6, 2], [128, 6, 2]].forEach(([x, y, w], i) => {
    solids.push(makeSolid(`lift-${i}`, x, y, w, 0.35, "platform"));
  });
  [1, 2, 3, 4, 5, 6].forEach((height, i) => solids.push(makeSolid(`end-step-${i}`, 134 + i, 13 - height, 1, height, "step")));

  const coins: Coin[] = [];
  const groups: Array<[number, number, number]> = [
    [30, 3, 4], [43, 5, 3], [55, 4, 4], [65, 3, 2], [84, 3, 2], [93, 9, 1],
    [102, 5, 2], [112, 6, 2], [120, 3, 4], [132, 10, 3],
  ];
  groups.forEach(([start, row, count], gi) => {
    for (let i = 0; i < count; i += 1) coins.push(makeCoin(`sky-coin-${gi}-${i}`, start + i, row, i * 0.5));
  });

  const enemies: Enemy[] = [44, 46, 80].map((x, i) => makeEnemy(`sky-goomba-${i}`, "goomba", x, i === 2 ? 7 : 7));
  [54, 74, 110, 133].forEach((x, i) => enemies.push(makeEnemy(`sky-para-${i}`, "parakoopa", x, i === 3 ? 13 : 8)));
  enemies.push(makeEnemy("sky-koopa", "koopa", 114, 8));

  return {
    index: 2,
    label: levelNames[2],
    theme: "athletic",
    width: 176 * TILE,
    goalX: 152 * TILE,
    castleX: 157 * TILE,
    solids,
    coins,
    enemies,
    hazards: [],
    powerups: [],
    particles: [],
    time: 300,
    ...stats,
    cameraX: 0,
    elapsed: 0,
    area: "main",
    pipeCooldown: 0,
    finishState: "none",
    finishTimer: 0,
    character,
  };
}

function makeWorld1_4(stats: Stats, character: Character): World {
  const solids: Solid[] = [];
  const castleRects: Array<[number, number, number, number]> = [
    [0, 0, 46, 2], [62, 0, 30, 2], [118, 0, 20, 2],
    [0, 10, 40, 5], [46, 9, 30, 6], [82, 10, 18, 5], [102, 12, 10, 3],
    [112, 10, 18, 5], [136, 12, 5, 3], [141, 9, 19, 6],
    [22, 6, 2, 4], [36, 6, 2, 3], [55, 8, 4, 2], [71, 5, 2, 4], [91, 9, 2, 3],
  ];
  castleRects.forEach(([x, y, w, h], i) => solids.push(makeSolid(`castle-${i}`, x, y, w, h, "castle")));
  solids.push(makeSolid("castle-power", 37, 6, 1, 1, "question", "mushroom"));
  solids.push(makeSolid("castle-power-2", 92, 9, 1, 1, "question", "mushroom"));
  solids.push(makeSolid("axe-bridge", 128, 11, 11, 0.35, "platform"));

  const hazards: Hazard[] = [
    { id: "lava-a", kind: "lava", x: 40 * TILE, y: 13 * TILE, w: 6 * TILE, h: 2 * TILE },
    { id: "lava-b", kind: "lava", x: 76 * TILE, y: 13 * TILE, w: 6 * TILE, h: 2 * TILE },
    { id: "lava-c", kind: "lava", x: 100 * TILE, y: 13 * TILE, w: 12 * TILE, h: 2 * TILE },
    { id: "lava-d", kind: "lava", x: 130 * TILE, y: 13 * TILE, w: 11 * TILE, h: 2 * TILE },
    { id: "bar-1", kind: "firebar", x: 30 * TILE + 24, y: 6 * TILE + 24, w: 24, h: 24, length: 6, direction: 1, speed: 1.8 },
    { id: "bar-2", kind: "firebar", x: 56 * TILE + 24, y: 9 * TILE + 24, w: 24, h: 24, length: 6, direction: -1, speed: 2.1 },
    { id: "bar-3", kind: "firebar", x: 87 * TILE + 24, y: 6 * TILE + 24, w: 24, h: 24, length: 6, direction: 1, speed: 2.3 },
    { id: "bar-4", kind: "firebar", x: 116 * TILE + 24, y: 10 * TILE + 24, w: 24, h: 24, length: 5, direction: -1, speed: 2.5 },
  ];

  return {
    index: 3,
    label: levelNames[3],
    theme: "castle",
    width: 160 * TILE,
    goalX: 140 * TILE,
    solids,
    coins: [],
    enemies: [makeEnemy("bowser", "bowser", 132, 11)],
    hazards,
    powerups: [],
    particles: [],
    time: 300,
    ...stats,
    cameraX: 0,
    elapsed: 0,
    area: "main",
    pipeCooldown: 0,
    finishState: "none",
    finishTimer: 0,
    character,
  };
}

function createWorld(index = 0, stats: Stats = { score: 0, coinCount: 0, lives: 3 }, character: Character = "mario"): World {
  if (index === 1) return makeWorld1_2(stats, character);
  if (index === 2) return makeWorld1_3(stats, character);
  if (index === 3) return makeWorld1_4(stats, character);
  return makeWorld1_1(stats, character);
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function approach(value: number, target: number, amount: number) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function isVisible(x: number, w: number, cameraX: number, padding = 80) {
  return x + w > cameraX - padding && x < cameraX + VIEW_W + padding;
}

function spawnScore(world: World, x: number, y: number, text: string, color = "#fff36d") {
  world.particles.push({ x, y, vx: 0, vy: -58, life: 0.9, color, size: 14, text });
}

function spawnBurst(world: World, x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * (60 + (i % 3) * 18),
      vy: Math.sin(angle) * 70 - 50,
      life: 0.58 + (i % 2) * 0.16,
      color,
      size: 3 + (i % 3),
    });
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.fillStyle = "#fcfcfc";
  ctx.fillRect(x + 16 * scale, y, 46 * scale, 14 * scale);
  ctx.fillRect(x, y + 14 * scale, 82 * scale, 20 * scale);
  ctx.fillStyle = "#3cbcfc";
  ctx.fillRect(x + 10 * scale, y + 34 * scale, 62 * scale, 7 * scale);
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number) {
  ctx.fillStyle = "#00a800";
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x + w * 0.5, base - h);
  ctx.lineTo(x + w, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#003800";
  ctx.fillRect(x + w * 0.48, base - h * 0.54, 7, 22);
}

function drawQuestion(ctx: CanvasRenderingContext2D, solid: Solid, sx: number, sy: number, t: number) {
  ctx.fillStyle = solid.used ? "#8c6b42" : "#000";
  ctx.fillRect(sx, sy, solid.w, solid.h);
  ctx.fillStyle = solid.used ? "#b89a6d" : "#fca044";
  ctx.fillRect(sx + 4, sy + 4, solid.w - 8, solid.h - 8);
  ctx.fillStyle = solid.used ? "#6f5637" : "#c84c0c";
  ctx.fillRect(sx + 5, sy + 5, 6, 6);
  ctx.fillRect(sx + solid.w - 11, sy + 5, 6, 6);
  ctx.fillRect(sx + 5, sy + solid.h - 11, 6, 6);
  ctx.fillRect(sx + solid.w - 11, sy + solid.h - 11, 6, 6);
  if (!solid.used) {
    ctx.fillStyle = "#000";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", sx + solid.w / 2, sy + solid.h / 2 + Math.sin(t * 4) * 1.5);
  }
}

function drawBrick(ctx: CanvasRenderingContext2D, solid: Solid, sx: number, sy: number, theme: Theme) {
  const castle = theme === "castle";
  const underground = theme === "underground";
  const base = castle ? "#bcbcbc" : underground ? "#007c8c" : "#c84c0c";
  const hi = castle ? "#fcfcfc" : underground ? "#00a8b8" : "#fca044";
  const dark = castle ? "#646464" : underground ? "#003840" : "#6b250f";
  ctx.fillStyle = dark;
  ctx.fillRect(sx, sy, solid.w, solid.h);
  ctx.fillStyle = base;
  ctx.fillRect(sx + 3, sy + 3, solid.w - 6, solid.h - 6);
  ctx.fillStyle = hi;
  ctx.fillRect(sx + 4, sy + 4, solid.w - 8, 5);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  for (let y = sy + 24; y < sy + solid.h; y += 24) {
    ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + solid.w, y); ctx.stroke();
  }
  for (let x = sx + 24; x < sx + solid.w; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + solid.h); ctx.stroke();
  }
}

function drawPipe(ctx: CanvasRenderingContext2D, solid: Solid, sx: number) {
  const capH = 28;
  ctx.fillStyle = "#003800";
  ctx.fillRect(sx + 8, solid.y + capH - 2, solid.w - 16, solid.h - capH + 2);
  ctx.fillStyle = "#00a800";
  ctx.fillRect(sx + 14, solid.y + capH, solid.w - 28, solid.h - capH);
  ctx.fillStyle = "#80d010";
  ctx.fillRect(sx + 18, solid.y + capH, 12, solid.h - capH);
  ctx.fillStyle = "#003800";
  ctx.fillRect(sx, solid.y + 4, solid.w, capH);
  ctx.fillStyle = "#00a800";
  ctx.fillRect(sx + 4, solid.y, solid.w - 8, capH);
  ctx.fillStyle = "#80d010";
  ctx.fillRect(sx + 14, solid.y + 3, 13, capH - 6);
}

function drawSidePipe(ctx: CanvasRenderingContext2D, solid: Solid, sx: number, sy: number) {
  const capW = 30;
  ctx.fillStyle = "#003800";
  ctx.fillRect(sx + capW - 2, sy + 8, solid.w - capW + 2, solid.h - 16);
  ctx.fillStyle = "#00a800";
  ctx.fillRect(sx + capW, sy + 14, solid.w - capW, solid.h - 28);
  ctx.fillStyle = "#80d010";
  ctx.fillRect(sx + capW, sy + 18, solid.w - capW, 13);
  ctx.fillStyle = "#003800";
  ctx.fillRect(sx + 4, sy, capW, solid.h);
  ctx.fillStyle = "#00a800";
  ctx.fillRect(sx, sy + 4, capW, solid.h - 8);
  ctx.fillStyle = "#80d010";
  ctx.fillRect(sx + 3, sy + 14, capW - 6, 13);
}

function drawMario(ctx: CanvasRenderingContext2D, player: Player, cameraX: number, t: number) {
  if (player.invuln > 0 && Math.floor(t * 15) % 2 === 0) return;
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y);
  const ux = 3;
  const uy = player.h / 18;
  const flip = player.facing;
  const rect = (gx: number, gy: number, gw: number, gh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(flip === 1 ? x + gx * ux : x + player.w - (gx + gw) * ux),
      Math.round(y + gy * uy),
      Math.round(gw * ux),
      Math.round(gh * uy),
    );
  };
  const running = Math.abs(player.vx) > 35 && player.grounded;
  const frame = Math.floor(player.runFrame) % 2;
  rect(3, 0, 7, 2, "#d82800"); rect(2, 2, 11, 2, "#fc3c2c");
  rect(3, 4, 8, 1, "#5f2b16"); rect(2, 5, 2, 4, "#5f2b16");
  rect(4, 5, 6, 4, "#fcbcb0"); rect(9, 5, 2, 2, "#000"); rect(10, 7, 3, 2, "#fcbcb0");
  rect(4, 9, 7, 1, "#5f2b16"); rect(3, 10, 8, 3, "#d82800");
  rect(1, 11, 3, 4, "#d82800"); rect(10, 11, 3, 4, "#d82800");
  rect(4, 11, 2, 5, "#0058f8"); rect(8, 11, 2, 5, "#0058f8"); rect(5, 13, 4, 4, "#0078f8");
  rect(2, 14, 2, 2, "#fcfcfc"); rect(10, 14, 2, 2, "#fcfcfc");
  if (!player.grounded) {
    rect(3, 16, 4, 2, "#5f2b16"); rect(8, 15, 4, 2, "#5f2b16");
  } else if (running && frame === 1) {
    rect(2, 16, 4, 2, "#5f2b16"); rect(8, 16, 5, 2, "#5f2b16");
  } else {
    rect(3, 16, 4, 2, "#5f2b16"); rect(8, 16, 4, 2, "#5f2b16");
  }
  if (player.powered) {
    ctx.strokeStyle = `rgba(255,244,111,${0.5 + Math.sin(t * 8) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 3, y - 3, player.w + 6, player.h + 6);
  }
}

const wangJianFrames = {
  stand: { x: 105, y: 200, w: 220, h: 505 },
  run: { x: 472, y: 210, w: 370, h: 500 },
  jump: { x: 915, y: 150, w: 330, h: 545 },
  celebrate: { x: 1340, y: 210, w: 340, h: 495 },
};

function drawWangJian(
  ctx: CanvasRenderingContext2D,
  player: Player,
  cameraX: number,
  t: number,
  sprite: HTMLImageElement | null,
  celebrating: boolean,
) {
  if (!sprite?.complete || sprite.naturalWidth === 0) {
    drawMario(ctx, player, cameraX, 0);
    return;
  }
  if (player.invuln > 0 && Math.floor(t * 15) % 2 === 0) return;
  const moving = Math.abs(player.vx) > 35 && player.grounded;
  const frame = celebrating ? wangJianFrames.celebrate : !player.grounded ? wangJianFrames.jump : moving ? wangJianFrames.run : wangJianFrames.stand;
  const height = player.h;
  const width = Math.round((height * frame.w) / frame.h);
  const x = Math.round(player.x - cameraX + player.w / 2 - width / 2);
  const y = Math.round(player.y + player.h - height);
  ctx.save();
  if (player.facing === -1 && !celebrating) {
    ctx.translate(x + width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, 0, y, width, height);
  } else {
    ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, x, y, width, height);
  }
  ctx.restore();
  if (player.powered) {
    ctx.strokeStyle = `rgba(255,244,111,${0.5 + Math.sin(t * 8) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, cameraX: number, t: number) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y + (enemy.dead ? 22 : 0));
  if (enemy.kind === "goomba") {
    const h = enemy.dead ? 15 : enemy.h;
    ctx.fillStyle = "#502000"; ctx.fillRect(x + 8, y, 24, h);
    ctx.fillStyle = "#a84818"; ctx.fillRect(x + 4, y + 8, 34, Math.max(8, h - 12));
    if (!enemy.dead) {
      ctx.fillStyle = "#fcbcb0"; ctx.fillRect(x + 8, y + 15, 9, 10); ctx.fillRect(x + 24, y + 15, 9, 10);
      ctx.fillStyle = "#000"; ctx.fillRect(x + 13, y + 16, 4, 7); ctx.fillRect(x + 24, y + 16, 4, 7);
      ctx.fillRect(x + 3, y + 34, 15, 6); ctx.fillRect(x + 23, y + 34, 15, 6);
    }
    return;
  }
  if (enemy.kind === "piranha") {
    ctx.fillStyle = "#fcfcfc"; ctx.fillRect(x + 6, y + 4, 22, 34);
    ctx.fillStyle = "#d82800"; ctx.fillRect(x + 2, y + 5, 30, 22); ctx.fillRect(x + 7, y, 20, 31);
    ctx.fillStyle = "#fcfcfc"; ctx.fillRect(x + 8, y + 6, 6, 6); ctx.fillRect(x + 21, y + 13, 6, 6);
    ctx.fillStyle = "#00a800"; ctx.fillRect(x + 14, y + 26, 8, 22); ctx.fillRect(x + 3, y + 34, 14, 7); ctx.fillRect(x + 19, y + 39, 14, 7);
    return;
  }
  if (enemy.kind === "bowser") {
    ctx.fillStyle = "#008800"; ctx.fillRect(x + 12, y + 8, 58, 64);
    ctx.fillStyle = "#80d010"; ctx.fillRect(x + 2, y + 25, 30, 36); ctx.fillRect(x + 55, y + 2, 26, 30);
    ctx.fillStyle = "#fca044"; ctx.fillRect(x + 56, y + 18, 32, 28); ctx.fillRect(x + 18, y + 72, 20, 18); ctx.fillRect(x + 56, y + 72, 20, 18);
    ctx.fillStyle = "#fcfcfc"; for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 20 + i * 12, y, 7, 12);
    ctx.fillStyle = "#000"; ctx.fillRect(x + 72, y + 23, 5, 6);
    return;
  }
  ctx.fillStyle = "#f0cf68"; ctx.fillRect(x + 10, y, 20, 17);
  ctx.fillStyle = enemy.kind === "redkoopa" ? "#d82800" : "#00a800"; ctx.fillRect(x + 3, y + 14, 34, 29);
  ctx.fillStyle = enemy.kind === "redkoopa" ? "#fc3c2c" : "#80d010"; ctx.fillRect(x + 9, y + 18, 22, 18);
  ctx.fillStyle = "#f4da84"; ctx.fillRect(x + 5, y + 43, 11, 9); ctx.fillRect(x + 25, y + 43, 11, 9);
  ctx.fillStyle = "#000"; ctx.fillRect(x + 22, y + 5, 4, 5);
  if (enemy.kind === "parakoopa") {
    const wing = Math.sin(t * 10) > 0 ? 0 : 5;
    ctx.fillStyle = "#fcfcfc";
    ctx.fillRect(x - 8, y + 13 + wing, 12, 20); ctx.fillRect(x + 37, y + 13 - wing, 12, 20);
    ctx.fillStyle = "#3cbcfc"; ctx.fillRect(x - 4, y + 18 + wing, 5, 10); ctx.fillRect(x + 40, y + 18 - wing, 5, 10);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, world: World) {
  const cameraX = world.cameraX;
  const inSurface = world.index === 1
    ? world.area === "entry" || world.area === "exit"
    : world.area === "main" && world.surfaceStart !== undefined && cameraX + VIEW_W / 2 >= world.surfaceStart;
  const theme: Theme = inSurface ? "overworld" : world.theme;
  if (theme === "underground" || theme === "castle") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  ctx.fillStyle = "#5c94fc";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawCloud(ctx, 100 - (cameraX * 0.18) % 920, 120, 1);
  drawCloud(ctx, 530 - (cameraX * 0.14) % 1080, 180, 0.8);
  drawCloud(ctx, 930 - (cameraX * 0.18) % 920, 86, 1.1);
  if (theme === "overworld") {
    drawHill(ctx, -100 - (cameraX * 0.35) % 820, FLOOR_Y, 300, 142);
    drawHill(ctx, 430 - (cameraX * 0.28) % 950, FLOOR_Y, 360, 190);
    for (let x = -((cameraX * 0.58) % 260); x < VIEW_W + 260; x += 260) {
      ctx.fillStyle = "#00a800"; ctx.fillRect(x, FLOOR_Y - 34, 110, 34); ctx.fillRect(x + 22, FLOOR_Y - 58, 66, 24);
    }
  }
}

function drawSurfaceCastle(ctx: CanvasRenderingContext2D, cx: number, raiseFlag = false, finishTimer = 0) {
  ctx.fillStyle = "#c84c0c"; ctx.fillRect(cx, 478, 188, 146); ctx.fillRect(cx + 22, 438, 52, 186); ctx.fillRect(cx + 114, 438, 52, 186);
  ctx.fillStyle = "#000"; ctx.fillRect(cx + 72, 550, 48, 74); ctx.fillRect(cx + 36, 482, 22, 34); ctx.fillRect(cx + 130, 482, 22, 34);
  ctx.fillStyle = "#fcfcfc"; for (let i = 0; i < 4; i += 1) ctx.fillRect(cx + i * 50, 424, 28, 18);
  if (raiseFlag) {
    const raise = Math.min(1, finishTimer / 1.2);
    const castleFlagY = 424 - raise * 92;
    ctx.fillStyle = "#80d010"; ctx.fillRect(cx + 93, 330, 5, 108);
    ctx.fillStyle = "#fcfcfc"; ctx.fillRect(cx + 98, castleFlagY, 52, 30);
    ctx.fillStyle = "#00a800"; ctx.fillRect(cx + 126, castleFlagY + 7, 15, 15);
  }
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  player: Player,
  character: Character,
  characterSprite: HTMLImageElement | null,
  celebrating = false,
) {
  const cameraX = world.cameraX;
  const t = world.elapsed;
  drawBackground(ctx, world);
  const inSurface = world.index === 1
    ? world.area === "entry" || world.area === "exit"
    : world.area === "main" && world.surfaceStart !== undefined && cameraX + VIEW_W / 2 >= world.surfaceStart;
  const activeTheme: Theme = inSurface ? "overworld" : world.theme;

  if (world.area === "entry" && world.startCastleX !== undefined) {
    const startCastleScreenX = world.startCastleX - cameraX;
    if (startCastleScreenX > -220 && startCastleScreenX < VIEW_W + 220) drawSurfaceCastle(ctx, startCastleScreenX);
  }

  for (const solid of world.solids) {
    if (solid.hidden && !solid.used) continue;
    if (!isVisible(solid.x, solid.w, cameraX)) continue;
    const sx = Math.round(solid.x - cameraX);
    const bumpY = solid.bump ? -Math.sin(Math.min(1, solid.bump / 0.18) * Math.PI) * 9 : 0;
    const sy = solid.y + bumpY;
    if (solid.kind === "question") drawQuestion(ctx, solid, sx, sy, t);
    else if (solid.kind === "pipe") drawPipe(ctx, solid, sx);
    else if (solid.kind === "sidePipe") drawSidePipe(ctx, solid, sx, sy);
    else if (solid.kind === "tree") {
      ctx.fillStyle = "#c84c0c"; ctx.fillRect(sx + 10, sy + 32, solid.w - 20, FLOOR_Y - sy - 32);
      ctx.fillStyle = "#80d010"; ctx.fillRect(sx, sy, solid.w, 34);
      ctx.fillStyle = "#00a800"; ctx.fillRect(sx, sy + 28, solid.w, 7);
    } else if (solid.kind === "platform") {
      ctx.fillStyle = "#fca044"; ctx.fillRect(sx, sy, solid.w, Math.max(14, solid.h));
      ctx.fillStyle = "#d82800"; for (let x = sx + 8; x < sx + solid.w; x += 22) ctx.fillRect(x, sy + 4, 8, 5);
    } else if (solid.kind === "brick") drawBrick(ctx, solid, sx, sy, activeTheme);
    else if (solid.kind === "castle" || activeTheme === "underground" || activeTheme === "castle") drawBrick(ctx, solid, sx, sy, activeTheme);
    else {
      ctx.fillStyle = "#6b250f"; ctx.fillRect(sx, sy, solid.w, solid.h);
      ctx.fillStyle = "#c84c0c"; ctx.fillRect(sx + 3, sy + 3, solid.w - 6, solid.h - 6);
      ctx.strokeStyle = "#6b250f"; ctx.lineWidth = 3;
      for (let x = sx; x < sx + solid.w; x += TILE) ctx.strokeRect(x, sy, TILE, Math.min(TILE, solid.h));
    }
  }

  for (const hazard of world.hazards) {
    if (hazard.kind === "lava") {
      if (!isVisible(hazard.x, hazard.w, cameraX)) continue;
      const sx = hazard.x - cameraX;
      ctx.fillStyle = "#d82800"; ctx.fillRect(sx, hazard.y, hazard.w, hazard.h);
      ctx.fillStyle = "#fca044";
      for (let x = sx; x < sx + hazard.w; x += 24) ctx.fillRect(x, hazard.y + Math.sin(t * 6 + x) * 3, 16, 8);
    } else {
      const cx = hazard.x - cameraX;
      const cy = hazard.y;
      const angle = t * (hazard.speed ?? 2) * (hazard.direction ?? 1);
      for (let i = 0; i < (hazard.length ?? 6); i += 1) {
        const x = cx + Math.cos(angle) * i * 24;
        const y = cy + Math.sin(angle) * i * 24;
        ctx.fillStyle = "#d82800"; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fca044"; ctx.fillRect(x - 5, y - 5, 10, 10);
      }
    }
  }

  for (const c of world.coins) {
    if (c.taken || !isVisible(c.x, c.w, cameraX)) continue;
    const sx = c.x - cameraX;
    const bob = Math.sin(t * 5 + c.phase) * 4;
    const spin = 0.28 + Math.abs(Math.sin(t * 7 + c.phase)) * 0.72;
    ctx.save(); ctx.translate(sx + 10, c.y + bob + 16); ctx.scale(spin, 1);
    ctx.fillStyle = "#a84800"; ctx.fillRect(-10, -16, 20, 32);
    ctx.fillStyle = "#fca044"; ctx.fillRect(-7, -13, 14, 26);
    ctx.fillStyle = "#fcfcfc"; ctx.fillRect(-3, -9, 3, 17); ctx.restore();
  }

  for (const powerup of world.powerups) {
    if (!powerup.active || !isVisible(powerup.x, powerup.w, cameraX)) continue;
    const sx = powerup.x - cameraX;
    if (powerup.kind === "star") {
      ctx.fillStyle = "#fca044";
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const radius = i % 2 === 0 ? 21 : 9;
        const x = sx + 23 + Math.cos(angle) * radius;
        const y = powerup.y + 22 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#000"; ctx.fillRect(sx + 15, powerup.y + 18, 4, 7); ctx.fillRect(sx + 27, powerup.y + 18, 4, 7);
    } else {
      ctx.fillStyle = "#fcbcb0"; ctx.fillRect(sx + 10, powerup.y + 17, 26, 23);
      ctx.fillStyle = powerup.kind === "oneUp" ? "#00a800" : "#d82800";
      ctx.fillRect(sx + 3, powerup.y + 4, 40, 19); ctx.fillRect(sx + 8, powerup.y, 30, 10);
      ctx.fillStyle = "#fcfcfc"; ctx.fillRect(sx + 9, powerup.y + 5, 9, 9); ctx.fillRect(sx + 28, powerup.y + 8, 8, 8);
    }
  }

  for (const enemy of world.enemies) {
    if (enemy.dead && enemy.squish <= 0) continue;
    if (isVisible(enemy.x, enemy.w, cameraX)) drawEnemy(ctx, enemy, cameraX, t);
  }

  if (world.index === 1 && world.area === "main" && cameraX > (WORLD_1_2_MAIN_START + 171) * TILE) {
    ctx.fillStyle = "#fcfcfc";
    ctx.font = "bold 19px monospace";
    ctx.textAlign = "center";
    ctx.fillText("WELCOME TO WARP ZONE!", VIEW_W / 2, 330);
    [[178, "4"], [182, "3"], [186, "2"]].forEach(([tile, label]) => {
      const x = (WORLD_1_2_MAIN_START + Number(tile) + 1) * TILE - cameraX;
      ctx.fillText(String(label), x, 455);
    });
  }

  if (world.theme !== "castle") {
    const flagX = world.goalX - cameraX;
    if (flagX > -100 && flagX < VIEW_W + 100) {
      const flagProgress = world.finishState === "pole" ? Math.min(1, world.finishTimer / 1.25) : world.finishState === "none" ? 0 : 1;
      const flagY = 108 + flagProgress * (448 - 108);
      ctx.fillStyle = "#80d010"; ctx.fillRect(flagX, 94, 8, FLOOR_Y - 94);
      ctx.fillStyle = "#00a800"; ctx.beginPath(); ctx.arc(flagX + 4, 86, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fcfcfc"; ctx.fillRect(flagX + 8, flagY, 64, 38);
      ctx.fillStyle = "#00a800"; ctx.fillRect(flagX + 42, flagY + 8, 18, 18);
    }
    if (world.castleX !== undefined) {
      const cx = world.castleX - cameraX;
      if (cx > -220 && cx < VIEW_W + 220) {
        drawSurfaceCastle(ctx, cx, world.finishState === "castleFlag", world.finishTimer);
      }
    }
  } else {
    const axeX = world.goalX - cameraX;
    if (axeX > -80 && axeX < VIEW_W + 80) {
      ctx.strokeStyle = "#fcfcfc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(axeX, 500); ctx.lineTo(axeX + 48, 446); ctx.stroke();
      ctx.fillStyle = "#fca044"; ctx.fillRect(axeX + 35, 432, 24, 38);
    }
  }

  if (world.finishState !== "castleFlag") {
    if (character === "wangjian") drawWangJian(ctx, player, cameraX, t, characterSprite, celebrating);
    else drawMario(ctx, player, cameraX, t);
  }
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.8)); ctx.fillStyle = p.color;
    if (p.text) { ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.fillText(p.text, p.x - cameraX, p.y); }
    else ctx.fillRect(p.x - cameraX, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const characterSpriteRef = useRef<HTMLImageElement | null>(null);
  const selectedCharacterRef = useRef<Character>("mario");
  const worldRef = useRef<World>(createWorld());
  const playerRef = useRef<Player>(initialPlayer());
  const phaseRef = useRef<Phase>("start");
  const controlsRef = useRef<Controls>({ left: false, right: false, down: false, jump: false, run: false });
  const jumpHeldRef = useRef(false);
  const qaInitializedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [selectedCharacter, setSelectedCharacter] = useState<Character>("mario");
  const [qaMode, setQaMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [levelIndex, setLevelIndex] = useState(0);
  const [hud, setHud] = useState({ score: 0, coins: 0, lives: 3, time: 400, world: levelNames[0], area: "main", playerX: 3, lastEvent: "none" });

  const chooseCharacter = useCallback((character: Character) => {
    selectedCharacterRef.current = character;
    setSelectedCharacter(character);
  }, []);

  const setGamePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
  }, []);

  const tone = useCallback((frequency: number, duration: number, type: OscillatorType = "square", volume = 0.026, endFrequency = frequency) => {
    if (mutedRef.current || !audioRef.current) return;
    const audio = audioRef.current;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
  }, []);

  const sound = useCallback((kind: "jump" | "coin" | "bump" | "power" | "stomp" | "hurt" | "win" | "pipe") => {
    if (kind === "jump") tone(270, 0.16, "square", 0.022, 510);
    if (kind === "coin") { tone(880, 0.08, "square", 0.021, 1200); window.setTimeout(() => tone(1320, 0.08, "square", 0.018), 65); }
    if (kind === "bump") tone(150, 0.08, "square", 0.024, 90);
    if (kind === "power") tone(330, 0.3, "square", 0.024, 980);
    if (kind === "stomp") tone(170, 0.1, "square", 0.027, 110);
    if (kind === "hurt") tone(260, 0.45, "sawtooth", 0.025, 55);
    if (kind === "win") [523, 659, 784, 1047].forEach((note, i) => window.setTimeout(() => tone(note, 0.18, "square", 0.022), i * 135));
    if (kind === "pipe") { tone(180, 0.16, "square", 0.022, 95); window.setTimeout(() => tone(120, 0.18, "square", 0.02, 70), 110); }
  }, [tone]);

  const loadLevel = useCallback((index: number, stats: Stats, character = selectedCharacterRef.current) => {
    selectedCharacterRef.current = character;
    setSelectedCharacter(character);
    worldRef.current = createWorld(index, stats, character);
    playerRef.current = initialPlayer();
    controlsRef.current = { left: false, right: false, down: false, jump: false, run: false };
    jumpHeldRef.current = false;
    setLevelIndex(index);
    setHud({ score: stats.score, coins: stats.coinCount, lives: stats.lives, time: worldRef.current.time, world: levelNames[index], area: worldRef.current.area, playerX: 3, lastEvent: "none" });
    setGamePhase("playing");
  }, [setGamePhase]);

  const resetGame = useCallback(() => {
    ensureAudio();
    loadLevel(0, { score: 0, coinCount: 0, lives: 3 }, selectedCharacterRef.current);
  }, [ensureAudio, loadLevel]);

  const nextLevel = useCallback(() => {
    const current = worldRef.current;
    const next = Math.min(3, current.index + 1);
    loadLevel(next, { score: current.score, coinCount: current.coinCount, lives: current.lives }, current.character);
  }, [loadLevel]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") setGamePhase("paused");
    else if (phaseRef.current === "paused") setGamePhase("playing");
  }, [setGamePhase]);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (qaInitializedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const qaRequest = params.get("qa");
    if (qaRequest !== "1-2" && qaRequest !== "world1") return;
    qaInitializedRef.current = true;
    setQaMode(true);
    const character: Character = params.get("character") === "wangjian" ? "wangjian" : "mario";
    const qaLevel = qaRequest === "1-2" ? 1 : Math.max(0, Math.min(3, Number(params.get("level") ?? 1) - 1));
    loadLevel(qaLevel, { score: 0, coinCount: 0, lives: 3 }, character);
    const world = worldRef.current;
    const player = playerRef.current;
    world.enemies.forEach((enemy) => { enemy.dead = true; enemy.squish = 0; });
    world.hazards.length = 0;
    const checkpoint = params.get("checkpoint") ?? "entry";
    const place = (area: World["area"], x: number, bottomRow: number, cameraTile: number) => {
      world.area = area; world.cameraX = cameraTile * TILE; world.pipeCooldown = 0;
      player.x = x * TILE; player.y = bottomRow * TILE - player.h; player.vx = 0; player.vy = 0; player.grounded = true;
    };
    if (checkpoint === "entry-pipe") place("entry", WORLD_1_2_MAP.entryPipe + 1 - player.w / TILE / 2, 10, 4);
    if (checkpoint === "main-start") place("main", WORLD_1_2_MAIN_START + 3, 13, WORLD_1_2_MAIN_START);
    if (checkpoint === "coins-a") place("main", WORLD_1_2_MAIN_START + 37, 13, WORLD_1_2_MAIN_START + 35);
    if (checkpoint === "coins-b") place("main", WORLD_1_2_MAIN_START + 82, 13, WORLD_1_2_MAIN_START + 80);
    if (checkpoint === "platforms") place("main", WORLD_1_2_MAIN_START + 132, 13, WORLD_1_2_MAIN_START + 130);
    if (checkpoint === "warp-zone") place("main", WORLD_1_2_MAIN_START + 177, 13, WORLD_1_2_MAIN_START + 176);
    if (checkpoint === "bonus-entry") place("main", WORLD_1_2_ENTRY_PIPE + 1 - player.w / TILE / 2, 9, WORLD_1_2_ENTRY_PIPE - 6);
    if (checkpoint === "bonus") place("bonus", WORLD_1_2_BONUS_START + 2.5, 13, WORLD_1_2_BONUS_START);
    if (checkpoint === "bonus-exit") place("bonus", WORLD_1_2_BONUS_EXIT + 1 - player.w / TILE / 2, 9, WORLD_1_2_BONUS_START);
    if (checkpoint === "normal-exit") place("main", WORLD_1_2_MAIN_EXIT - player.w / TILE, 9, WORLD_1_2_MAIN_EXIT - 7);
    if (checkpoint === "exit") place("exit", WORLD_1_2_EXIT_START + 4 - player.w / TILE / 2, 11, WORLD_1_2_EXIT_START);
    if (checkpoint === "goal") place(world.index === 1 ? "exit" : "main", world.goalX / TILE - 2, world.index === 3 ? 11 : 13, world.goalX / TILE - 9);
    const sourceTile = Number(params.get("source"));
    if (Number.isFinite(sourceTile) && params.has("source")) place("main", WORLD_1_2_MAIN_START + sourceTile, 13, WORLD_1_2_MAIN_START + sourceTile - 5);
    const action = params.get("action");
    if (action === "down") controlsRef.current.down = true;
    if (action === "right") controlsRef.current.right = true;
    if (action === "jump-right") {
      player.vx = 342; controlsRef.current.right = true; controlsRef.current.run = true;
      window.setTimeout(() => { controlsRef.current.jump = true; }, 320);
      window.setTimeout(() => { controlsRef.current.jump = false; }, 860);
    }
    window.setTimeout(() => {
      controlsRef.current = { left: false, right: false, down: false, jump: false, run: false };
    }, action === "jump-right" ? 1700 : action === "right" ? 1200 : 500);
  }, [loadLevel]);

  useEffect(() => {
    const sprite = new Image();
    // 站点部署在子目录下，精灵图走相对基址而不是根路径
    sprite.src = `${import.meta.env.BASE_URL}character-sprites.png`;
    characterSpriteRef.current = sprite;
    return () => { characterSpriteRef.current = null; };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent, down: boolean) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "a", "d", "s", "w", "x", "shift", "p", "escape"].includes(key)) event.preventDefault();
      if (phaseRef.current === "start" && down && !event.repeat) {
        if (key === "arrowleft" || key === "a") chooseCharacter("mario");
        if (key === "arrowright" || key === "d") chooseCharacter("wangjian");
      }
      if (key === "arrowleft" || key === "a") controlsRef.current.left = down;
      if (key === "arrowright" || key === "d") controlsRef.current.right = down;
      if (key === "arrowdown" || key === "s") controlsRef.current.down = down;
      if (key === "arrowup" || key === "w" || key === " ") controlsRef.current.jump = down;
      if (key === "x" || key === "shift") controlsRef.current.run = down;
      if (down && !event.repeat && (key === "p" || key === "escape")) togglePause();
      if (down && !event.repeat && key === "enter") {
        if (phaseRef.current === "cleared") nextLevel();
        else if (phaseRef.current === "paused") setGamePhase("playing");
        else if (phaseRef.current !== "playing") resetGame();
      }
    };
    const keydown = (event: KeyboardEvent) => onKey(event, true);
    const keyup = (event: KeyboardEvent) => onKey(event, false);
    const release = () => { controlsRef.current = { left: false, right: false, down: false, jump: false, run: false }; };
    window.addEventListener("keydown", keydown, { passive: false });
    window.addEventListener("keyup", keyup, { passive: false });
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", release);
    };
  }, [chooseCharacter, nextLevel, resetGame, setGamePhase, togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let frameId = 0;
    let previous = performance.now();
    let hudTimer = 0;

    const collideHorizontal = (body: Box & { vx: number }, world: World) => {
      for (const solid of world.solids) {
        if (!overlaps(body, solid)) continue;
        if (body.vx > 0) body.x = solid.x - body.w;
        else if (body.vx < 0) body.x = solid.x + solid.w;
        body.vx *= -0.05;
      }
    };

    const collideVertical = (body: Box & { vy: number }, world: World, onHeadHit?: (solid: Solid) => void) => {
      let landed = false;
      for (const solid of world.solids) {
        if (!overlaps(body, solid)) continue;
        if (body.vy > 0) { body.y = solid.y - body.h; body.vy = 0; landed = true; }
        else if (body.vy < 0) { body.y = solid.y + solid.h; body.vy = 0; onHeadHit?.(solid); }
      }
      return landed;
    };

    const loseLife = (reason = "unknown") => {
      const world = worldRef.current;
      const player = playerRef.current;
      if (player.invuln > 0) return;
      world.qaLastEvent = reason;
      sound("hurt");
      world.lives -= 1;
      if (world.lives <= 0) { setGamePhase("lost"); return; }
      player.x = TILE * 3; player.y = FLOOR_Y - player.h; player.vx = 0; player.vy = -260;
      player.powered = false; player.starTimer = 0; player.invuln = 2.2; world.cameraX = 0; world.area = world.index === 1 ? "entry" : "main"; world.pipeCooldown = 0; world.finishState = "none"; world.finishTimer = 0;
    };

    const hitHazard = (world: World, player: Player) => {
      for (const hazard of world.hazards) {
        if (hazard.kind === "lava" && overlaps(player, hazard)) return true;
        if (hazard.kind === "firebar") {
          const angle = world.elapsed * (hazard.speed ?? 2) * (hazard.direction ?? 1);
          for (let i = 0; i < (hazard.length ?? 6); i += 1) {
            const fire: Box = { x: hazard.x + Math.cos(angle) * i * 24 - 10, y: hazard.y + Math.sin(angle) * i * 24 - 10, w: 20, h: 20 };
            if (overlaps(player, fire)) return true;
          }
        }
      }
      return false;
    };

    const update = (dt: number) => {
      const world = worldRef.current;
      const player = playerRef.current;
      const controls = controlsRef.current;
      world.elapsed += dt;
      if (world.finishState !== "none") {
        world.finishTimer += dt;
        if (world.finishState === "pole") {
          player.x = world.goalX - player.w * 0.42;
          player.y = Math.min(FLOOR_Y - player.h, player.y + 176 * dt);
          player.vx = 0; player.vy = 0; player.grounded = false; player.facing = 1;
          if (world.finishTimer >= 1.25) {
            world.finishState = "walk"; world.finishTimer = 0;
            player.x = world.goalX + 14; player.y = FLOOR_Y - player.h; player.vx = 138; player.grounded = true;
          }
        } else if (world.finishState === "walk") {
          player.vx = 138; player.facing = 1; player.grounded = true;
          player.x += player.vx * dt; player.y = FLOOR_Y - player.h; player.runFrame += Math.abs(player.vx) * dt / 46;
          const cameraTarget = Math.max(0, Math.min(world.width - VIEW_W, player.x - TILE * 6));
          world.cameraX += (cameraTarget - world.cameraX) * Math.min(1, dt * 5.5);
          const reachedCastle = world.castleX !== undefined && player.x > world.castleX + 62;
          if (reachedCastle || world.finishTimer >= 2.5) {
            world.finishState = "castleFlag"; world.finishTimer = 0; player.vx = 0;
            if (world.castleX !== undefined) spawnBurst(world, world.castleX + 96, 392, "#fcfcfc", 10);
          }
        } else if (world.finishTimer >= 1.35) {
          world.score += Math.floor(world.time) * 10;
          setGamePhase(world.index === 3 ? "won" : "cleared");
        }
        for (const p of world.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.text ? 0 : 240 * dt; p.life -= dt; }
        world.particles = world.particles.filter((particle) => particle.life > 0);
        return;
      }
      world.time = Math.max(0, world.time - dt);
      world.pipeCooldown = Math.max(0, world.pipeCooldown - dt);
      if (world.time <= 0) { setGamePhase("lost"); return; }

      for (const solid of world.solids) {
        if (solid.motion === "vertical" && solid.originY !== undefined) {
          const travel = (1 - Math.cos(world.elapsed * 1.35 + (solid.phase ?? 0))) * 0.5;
          solid.y = solid.originY + travel * (solid.travelRows ?? 6) * TILE;
        }
      }

      if (controls.jump && !jumpHeldRef.current) player.jumpBuffer = 0.14;
      jumpHeldRef.current = controls.jump;
      player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
      player.coyote = player.grounded ? 0.1 : Math.max(0, player.coyote - dt);
      player.invuln = Math.max(0, player.invuln - dt);
      player.starTimer = Math.max(0, player.starTimer - dt);

      const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
      const maxSpeed = controls.run ? 342 : 235;
      const acceleration = player.grounded ? 1680 : 980;
      if (direction !== 0) { player.vx = approach(player.vx, direction * maxSpeed, acceleration * dt); player.facing = direction as 1 | -1; }
      else player.vx = approach(player.vx, 0, (player.grounded ? 1420 : 360) * dt);

      if (player.jumpBuffer > 0 && player.coyote > 0) {
        player.vy = controls.run ? -745 : -690; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0; sound("jump");
      }
      player.vy = Math.min(980, player.vy + (controls.jump && player.vy < 0 ? 1120 : 1820) * dt);
      player.x += player.vx * dt; collideHorizontal(player, world); player.x = Math.max(0, Math.min(world.width - player.w, player.x));
      player.y += player.vy * dt;
      player.grounded = collideVertical(player, world, (solid) => {
        if (solid.kind !== "question" && solid.kind !== "brick") return;
        solid.bump = 0.001; sound("bump");
        if (!solid.reward || solid.used) return;
        if (solid.reward === "multiCoin") {
          solid.hits = (solid.hits ?? 0) + 1;
          solid.used = solid.hits >= 10;
          world.coinCount += 1; world.score += 200;
          spawnScore(world, solid.x + 24, solid.y - 24, "+200"); spawnBurst(world, solid.x + 24, solid.y - 8, "#fca044", 7); sound("coin");
          return;
        }
        solid.used = true;
        if (solid.reward === "mushroom" || solid.reward === "star" || solid.reward === "oneUp") {
          world.powerups.push({ id: `p-${solid.id}`, kind: solid.reward, x: solid.x + 1, y: solid.y - 42, w: 46, h: 40, vx: 82, vy: -60, active: true }); sound("power");
        } else {
          world.coinCount += 1; world.score += 200; spawnScore(world, solid.x + 24, solid.y - 24, "+200"); spawnBurst(world, solid.x + 24, solid.y - 8, "#fca044", 7); sound("coin");
        }
      });
      if (world.index === 1) {
        const transition = getWorld12Transition({
          area: world.area,
          cooldown: world.pipeCooldown,
          down: controls.down,
          right: controls.right,
          grounded: player.grounded,
          centerTile: (player.x + player.w / 2) / TILE,
          rightTile: (player.x + player.w) / TILE,
          topRow: player.y / TILE,
          bottomRow: (player.y + player.h) / TILE,
        });
        if (transition === "enter-main") {
          world.area = "main"; world.pipeCooldown = 0.7; world.cameraX = WORLD_1_2_MAIN_START * TILE;
          player.x = (WORLD_1_2_MAIN_START + 3) * TILE; player.y = 2 * TILE; player.vx = 0; player.vy = 90; player.grounded = false;
          sound("pipe");
        } else if (transition === "enter-bonus") {
          world.area = "bonus"; world.pipeCooldown = 0.7; world.cameraX = WORLD_1_2_BONUS_START * TILE;
          player.x = (WORLD_1_2_BONUS_START + 2.5) * TILE; player.y = 3 * TILE; player.vx = 0; player.vy = 90; player.grounded = false;
          sound("pipe");
        } else if (transition === "return-main") {
          world.area = "main"; world.pipeCooldown = 0.7; world.cameraX = (WORLD_1_2_RETURN_PIPE - 5) * TILE;
          player.x = (WORLD_1_2_RETURN_PIPE + 1) * TILE - player.w / 2; player.y = 10 * TILE - player.h; player.vx = 0; player.vy = -120; player.grounded = false;
          sound("pipe");
        } else if (transition === "enter-exit") {
          world.area = "exit"; world.pipeCooldown = 0.7; world.cameraX = WORLD_1_2_EXIT_START * TILE;
          player.x = (WORLD_1_2_EXIT_START + 4) * TILE - player.w / 2; player.y = 11 * TILE - player.h;
          player.vx = 0; player.vy = -120; player.grounded = false; sound("pipe");
        }
      }
      player.runFrame += Math.abs(player.vx) * dt / 46;
      if (player.y > VIEW_H + 120) loseLife("fall");
      else if (hitHazard(world, player)) loseLife("hazard");

      for (const solid of world.solids) if (solid.bump) { solid.bump += dt; if (solid.bump > 0.22) solid.bump = 0; }
      for (const c of world.coins) if (!c.taken && overlaps(player, c)) {
        c.taken = true; world.coinCount += 1; world.score += 100; spawnScore(world, c.x + 10, c.y, "+100"); spawnBurst(world, c.x + 10, c.y + 12, "#fca044", 6); sound("coin");
      }

      for (const enemy of world.enemies) {
        if (enemy.dead) { enemy.squish -= dt; continue; }
        if (!isVisible(enemy.x, enemy.w, world.cameraX, TILE * 4)) continue;
        if (enemy.kind === "piranha") {
          const rise = Math.max(0, Math.sin(world.elapsed * 1.7 + (enemy.phase ?? 0))) * 58;
          enemy.y = (enemy.originY ?? enemy.y) - rise;
        } else {
          if (enemy.kind === "parakoopa") enemy.vy += Math.sin(world.elapsed * 6 + enemy.x) * 18 * dt;
          enemy.vy = Math.min(800, enemy.vy + 1550 * dt);
          enemy.x += enemy.vx * dt;
          const beforeVx = enemy.vx; collideHorizontal(enemy, world);
          if (Math.abs(enemy.vx) < Math.abs(beforeVx) * 0.5) enemy.vx = -beforeVx;
          enemy.y += enemy.vy * dt; collideVertical(enemy, world);
        }
        if (enemy.y > VIEW_H + 140) enemy.dead = true;
        if (!overlaps(player, enemy)) continue;
        if (player.starTimer > 0) {
          enemy.dead = true; enemy.squish = 0.35; world.score += 1000;
          spawnScore(world, enemy.x + 20, enemy.y - 6, "+1000"); spawnBurst(world, enemy.x + 20, enemy.y + 20, "#fff36d", 10); sound("stomp");
          continue;
        }
        const stomp = enemy.kind !== "bowser" && enemy.kind !== "piranha" && player.vy > 110 && player.y + player.h < enemy.y + enemy.h * 0.72;
        if (stomp) {
          enemy.dead = true; enemy.squish = 0.5; player.vy = -430; world.score += enemy.kind === "goomba" ? 200 : 400;
          spawnScore(world, enemy.x + 20, enemy.y - 6, enemy.kind === "goomba" ? "+200" : "+400"); sound("stomp");
        } else if (player.invuln <= 0) {
          if (player.powered) { player.powered = false; player.invuln = 1.8; player.vx = player.x < enemy.x ? -320 : 320; player.vy = -300; sound("hurt"); }
          else loseLife(`enemy:${enemy.id}`);
        }
      }

      for (const powerup of world.powerups) {
        if (!powerup.active) continue;
        powerup.vy = Math.min(700, powerup.vy + 1450 * dt); powerup.x += powerup.vx * dt;
        const previousVx = powerup.vx; collideHorizontal(powerup, world);
        if (Math.abs(powerup.vx) < Math.abs(previousVx) * 0.5) powerup.vx = -previousVx;
        powerup.y += powerup.vy * dt;
        const landed = collideVertical(powerup, world);
        if (powerup.kind === "star" && landed) powerup.vy = -470;
        if (overlaps(player, powerup)) {
          powerup.active = false; world.score += 1000;
          if (powerup.kind === "oneUp") world.lives += 1;
          else if (powerup.kind === "star") player.starTimer = 10;
          else { player.powered = true; player.invuln = 0.8; }
          spawnScore(world, powerup.x + 22, powerup.y, powerup.kind === "oneUp" ? "1UP" : "+1000");
          spawnBurst(world, powerup.x + 22, powerup.y + 20, "#ffea67", 12); sound("power");
        }
      }

      for (const p of world.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.text ? 0 : 240 * dt; p.life -= dt; }
      world.particles = world.particles.filter((particle) => particle.life > 0);
      const cameraTarget = world.area === "bonus"
        ? WORLD_1_2_BONUS_START * TILE
        : Math.max(0, Math.min(world.width - VIEW_W, player.x - TILE * 6));
      world.cameraX += (cameraTarget - world.cameraX) * Math.min(1, dt * 5.5);

      const canFinish = world.index === 1 ? world.area === "exit" : world.area === "main";
      if (canFinish && player.x + player.w > world.goalX) {
        if (world.theme === "castle") {
          world.score += Math.floor(world.time) * 10; sound("win"); setGamePhase("won");
        } else {
          const heightRatio = Math.max(0, Math.min(1, (FLOOR_Y - player.y) / (FLOOR_Y - 94)));
          const poleScore = 100 + Math.round(heightRatio * 19) * 100;
          world.score += poleScore; spawnScore(world, world.goalX - 16, Math.max(126, player.y), `+${poleScore}`);
          world.finishState = "pole"; world.finishTimer = 0; player.vx = 0; player.vy = 0; sound("win");
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - previous) / 1000); previous = now;
      if (phaseRef.current === "playing") update(dt);
      drawWorld(ctx, worldRef.current, playerRef.current, worldRef.current.character, characterSpriteRef.current, phaseRef.current === "won");
      hudTimer += dt;
      if (hudTimer > 0.08) {
        const world = worldRef.current;
        setHud({ score: world.score, coins: world.coinCount, lives: world.lives, time: Math.ceil(world.time), world: world.label, area: world.area, playerX: world.index === 1 ? (playerRef.current.x / TILE) : 0, lastEvent: world.qaLastEvent ?? "none" });
        hudTimer = 0;
      }
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [setGamePhase, sound]);

  const bindControl = (name: keyof Controls) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); controlsRef.current[name] = true; event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); controlsRef.current[name] = false; },
    onPointerCancel: () => { controlsRef.current[name] = false; },
  });

  return (
    <main className="game-page">
      <div className="ambient-stars" aria-hidden="true" />
      <header className="console-header">
        <div>
          <p className="eyebrow">NES WORLD 1 / ORIGINAL GRID</p>
          <h1>SUPER WANGJIAN</h1>
        </div>
        <div className="level-track" aria-label="World 1 关卡进度">
          {levelNames.map((name, index) => <span key={name} className={index === levelIndex ? "active" : index < levelIndex ? "done" : ""}>{index + 1}</span>)}
        </div>
        <div className="header-actions">
          <span className="status-dot"><i /> 本地运行</span>
          <button type="button" className="icon-button" onClick={() => { ensureAudio(); setMuted((value) => !value); }} aria-label={muted ? "打开声音" : "静音"}>{muted ? "×♪" : "♪"}</button>
          <button type="button" className="icon-button" onClick={togglePause} aria-label="暂停游戏">{phase === "paused" ? "▶" : "Ⅱ"}</button>
        </div>
      </header>

      <section className="console-shell" aria-label="超级马里奥兄弟 World 1 游戏">
        <div className="screen-bezel">
          <div className="game-stage original-ratio">
            <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} aria-label="NES 风格横版马里奥游戏画面" />
            <div className="scanlines" aria-hidden="true" />
            <div className="hud" aria-live="polite">
              <div><small>{selectedCharacter === "mario" ? "MARIO" : "WANG JIAN"}</small><strong>{hud.score.toString().padStart(6, "0")}</strong></div>
              <div><small>× COIN</small><strong>{hud.coins.toString().padStart(2, "0")}</strong></div>
              <div><small>WORLD</small><strong>{hud.world.replace("WORLD ", "")}</strong></div>
              <div><small>TIME</small><strong>{hud.time.toString().padStart(3, "0")}</strong></div>
              <div className="lives"><small>LIVES</small><strong>× {hud.lives}</strong></div>
            </div>
            {qaMode && <output className="qa-status" data-testid="qa-status">QA · {hud.world} · {hud.area} · X {hud.playerX.toFixed(1)} · {selectedCharacter} · {hud.lastEvent}</output>}

            {phase !== "playing" && (
              <div className="game-overlay">
                <div className="overlay-card">
                  {phase === "start" && <><span className="pixel-badge">PLAYER SELECT</span><h2>选择人物</h2><p>两名角色拥有相同操作与跳跃能力。方向键选择，按 Enter 开始。</p><div className="character-picker" role="radiogroup" aria-label="选择游戏人物"><button type="button" role="radio" aria-checked={selectedCharacter === "mario"} className={selectedCharacter === "mario" ? "character-card selected" : "character-card"} onClick={() => chooseCharacter("mario")}><span className="mario-choice" aria-hidden="true">M</span><strong>经典马里奥</strong><small>PLAYER 1</small></button><button type="button" role="radio" aria-checked={selectedCharacter === "wangjian"} className={selectedCharacter === "wangjian" ? "character-card selected" : "character-card"} onClick={() => chooseCharacter("wangjian")}><span className="wangjian-choice" aria-hidden="true" /><strong>王健</strong><small>PLAYER 2</small></button></div><button type="button" className="primary-button" onClick={resetGame}>从 1–1 开始 <kbd>ENTER</kbd></button></>}
                  {phase === "paused" && <><span className="pixel-badge">PAUSED</span><h2>{hud.world}</h2><p>关卡已暂停。</p><button type="button" className="primary-button" onClick={() => setGamePhase("playing")}>继续游戏</button></>}
                  {phase === "cleared" && <><span className="pixel-badge success">COURSE CLEAR!</span><h2>{hud.world} 完成</h2><p>得分 {hud.score.toString().padStart(6, "0")} · 下一关 {levelNames[Math.min(3, levelIndex + 1)]}</p><button type="button" className="primary-button" onClick={nextLevel}>进入下一关 <kbd>ENTER</kbd></button></>}
                  {phase === "won" && <><span className="pixel-badge success">WORLD CLEAR!</span><h2>谢谢你，{selectedCharacter === "mario" ? "马里奥" : "王健"}！</h2><p>你已经完成 World 1 的四个原版关卡。最终得分 <b>{hud.score.toString().padStart(6, "0")}</b></p><button type="button" className="primary-button" onClick={resetGame}>重新挑战</button></>}
                  {phase === "lost" && <><span className="pixel-badge danger">GAME OVER</span><h2>冒险结束</h2><p>重新从 World 1–1 开始。</p><button type="button" className="primary-button" onClick={resetGame}>重新开始</button></>}
                </div>
              </div>
            )}

            <div className="touch-controls" aria-label="触控操作">
              <div className="dpad"><button type="button" aria-label="向左" {...bindControl("left")}>◀</button><button type="button" aria-label="向下进入管道" {...bindControl("down")}>▼</button><button type="button" aria-label="向右" {...bindControl("right")}>▶</button></div>
              <div className="action-pad"><button type="button" className="run-button" aria-label="加速" {...bindControl("run")}>B</button><button type="button" className="jump-button" aria-label="跳跃" {...bindControl("jump")}>A</button></div>
            </div>
          </div>
        </div>
        <div className="console-label"><span>PLAYER 1</span><i /><span>{hud.world}</span></div>
      </section>

      <footer className="control-guide">
        <span><kbd>←</kbd><kbd>→</kbd> 移动</span><span><kbd>↓</kbd> 进入管道</span><span><kbd>SPACE</kbd> 跳跃</span><span><kbd>SHIFT</kbd> 加速</span><span><kbd>P</kbd> 暂停</span>
        <em>World 1：地面 · 地下 · 高空 · 城堡</em>
      </footer>
    </main>
  );
}
