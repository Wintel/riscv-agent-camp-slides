import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
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
} from "../src/world-1-2-data.mjs";

function staticCells() {
  const cells = new Set();
  for (const [row, runs] of WORLD_1_2_STATIC_RUNS) {
    for (const [start, end] of runs) {
      for (let x = start; x <= end; x += 1) cells.add(`${x},${row}`);
    }
  }
  for (const block of [...WORLD_1_2_QUESTION_BLOCKS, ...WORLD_1_2_REWARD_BLOCKS]) cells.add(`${block.x},${block.y}`);
  for (const pipe of WORLD_1_2_PIPES) {
    for (let y = pipe.top; y <= 12; y += 1) {
      cells.add(`${pipe.x},${y}`);
      cells.add(`${pipe.x + 1},${y}`);
    }
  }
  for (let x = 166; x <= 168; x += 1) for (let y = 8; y <= 9; y += 1) cells.add(`${x},${y}`);
  return cells;
}

test("World 1-2 loose coins match the reference grid and never overlap solids", () => {
  assert.equal(WORLD_1_2_LOOSE_COINS.length, 17);
  assert.deepEqual(WORLD_1_2_LOOSE_COINS, [
    [41, 5], [42, 5], [43, 5], [44, 5],
    [84, 5], [85, 5], [86, 5], [87, 5], [88, 5], [89, 5],
    [40, 8], [45, 8], [58, 8], [59, 8], [60, 8], [61, 8], [68, 8],
  ]);
  const cells = staticCells();
  for (const [x, y] of WORLD_1_2_LOOSE_COINS) {
    assert.equal(cells.has(`${x},${y}`), false, `coin ${x},${y} overlaps a solid tile`);
  }
});

test("World 1-2 bonus room contains 17 reachable loose coins plus its ten-coin block", () => {
  assert.equal(WORLD_1_2_BONUS_COINS.length, 17);
  for (const [x, y] of WORLD_1_2_BONUS_COINS) {
    assert.ok(x > 0 && x < 12, `bonus coin ${x},${y} is inside a wall or exit pipe`);
    assert.ok(y > 2 && y < 13, `bonus coin ${x},${y} is inside the ceiling or floor`);
  }
});

test("World 1-2 floor gaps, pipes and four lifts match the reference grid", () => {
  const gridHash = createHash("sha256").update(JSON.stringify(WORLD_1_2_STATIC_RUNS)).digest("hex");
  assert.equal(gridHash, "6a86e49d57df0181c2f61aa518f1cd06d5c7b22d7d2b644e6aab5472dc94d4da");
  const floor = WORLD_1_2_STATIC_RUNS.find(([row]) => row === 13)?.[1];
  assert.deepEqual(floor, [[0, 79], [83, 119], [122, 123], [126, 137], [145, 152], [160, 191]]);
  assert.deepEqual(WORLD_1_2_PIPES.map(({ x, top }) => [x, top]), [
    [103, 9], [109, 8], [115, 10], [178, 10], [182, 10], [186, 10],
  ]);
  assert.equal(WORLD_1_2_MOVING_PLATFORMS.length, 4);
  assert.deepEqual(WORLD_1_2_MOVING_PLATFORMS.map(({ x, width, top, bottom }) => [x, width, top, bottom]), [
    [139, 4, 6, 12], [139, 4, 6, 12], [154, 4, 4, 12], [154, 4, 4, 12],
  ]);
});

test("World 1-2 portal rules cover entry, coin room return, normal exit and reject wrong heights", () => {
  const base = { cooldown: 0, down: false, right: false, grounded: true, centerTile: 0, rightTile: 0, topRow: 0, bottomRow: 0 };
  assert.equal(getWorld12Transition({ ...base, area: "entry", down: true, centerTile: 11, bottomRow: 10 }), "enter-main");
  assert.equal(getWorld12Transition({ ...base, area: "main", down: true, centerTile: WORLD_1_2_MAP.mainStart + 104, bottomRow: 9 }), "enter-bonus");
  assert.equal(getWorld12Transition({ ...base, area: "bonus", down: true, centerTile: WORLD_1_2_MAP.bonusStart + 13, bottomRow: 9 }), "return-main");
  assert.equal(getWorld12Transition({ ...base, area: "main", right: true, rightTile: WORLD_1_2_MAP.mainStart + 166, topRow: 8.7, bottomRow: 9.8 }), "enter-exit");
  assert.equal(getWorld12Transition({ ...base, area: "main", down: true, centerTile: WORLD_1_2_MAP.mainStart + 104, bottomRow: 8 }), null);
  assert.equal(getWorld12Transition({ ...base, area: "main", right: true, rightTile: WORLD_1_2_MAP.mainStart + 165, topRow: 8.7, bottomRow: 9.8 }), null);
});

test("World 1-2 enemy and reward counts are internally consistent", () => {
  assert.equal(WORLD_1_2_GOOMBAS.length, 14);
  assert.equal(WORLD_1_2_KOOPAS.filter(({ kind }) => kind === "koopa").length, 3);
  assert.equal(WORLD_1_2_KOOPAS.filter(({ kind }) => kind === "redkoopa").length, 1);
  assert.equal(WORLD_1_2_QUESTION_BLOCKS.filter(({ reward }) => reward === "coin").length, 4);
  assert.equal(WORLD_1_2_REWARD_BLOCKS.filter(({ reward }) => reward === "multiCoin").length, 2);
  assert.equal(WORLD_1_2_REWARD_BLOCKS.filter(({ reward }) => reward === "star").length, 1);
  assert.equal(WORLD_1_2_REWARD_BLOCKS.filter(({ reward }) => reward === "oneUp").length, 1);
  const totalCoins = WORLD_1_2_LOOSE_COINS.length
    + WORLD_1_2_BONUS_COINS.length
    + WORLD_1_2_QUESTION_BLOCKS.filter(({ reward }) => reward === "coin").length
    + (WORLD_1_2_REWARD_BLOCKS.filter(({ reward }) => reward === "multiCoin").length + Number(WORLD_1_2_BONUS_MULTICOIN_BLOCK.reward === "multiCoin")) * 10;
  assert.equal(totalCoins, 68);
  const spawnKeys = [...WORLD_1_2_GOOMBAS.map(({ x, top }) => `goomba:${x}:${top}`), ...WORLD_1_2_KOOPAS.map(({ x, top }) => `koopa:${x}:${top}`)];
  assert.equal(new Set(spawnKeys).size, spawnKeys.length);
});
