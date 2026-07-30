// World 1-2 coordinates transcribed from the 192 x 15 NESMaps tile grid.
// Coordinates in this file use original 16 px source tiles; Game.tsx scales them to 48 px.

export const WORLD_1_2_MAP = Object.freeze({
  mainStart: 32,
  entryPipe: 10,
  bonusEntryPipe: 103,
  bonusReturnPipe: 115,
  normalExitPipe: 166,
  exitStart: 240,
  bonusStart: 300,
  bonusExitPipe: 12,
});

// [row, [[inclusive start, inclusive end], ...]]
// Special blocks, pipes and moving platforms are deliberately excluded.
export const WORLD_1_2_STATIC_RUNS = Object.freeze([
  [2, [[0, 0], [6, 88], [90, 137], [161, 186], [190, 191]]],
  [3, [[0, 0], [54, 55], [58, 63], [66, 69], [76, 79], [168, 176], [190, 191]]],
  [4, [[0, 0], [54, 55], [58, 63], [66, 69], [76, 79], [168, 176], [190, 191]]],
  [5, [[0, 0], [52, 53], [62, 63], [67, 67], [72, 72], [168, 176], [190, 191]]],
  [6, [[0, 0], [52, 53], [62, 63], [67, 67], [72, 73], [168, 176], [190, 191]]],
  [7, [[0, 0], [39, 39], [41, 44], [52, 53], [62, 63], [67, 67], [72, 73], [84, 89], [168, 176], [190, 191]]],
  [8, [[0, 0], [39, 39], [41, 41], [44, 44], [52, 53], [62, 63], [67, 67], [72, 72], [84, 89], [145, 149], [169, 176], [190, 191]]],
  [9, [[0, 0], [23, 23], [25, 25], [39, 41], [44, 46], [52, 55], [58, 63], [67, 69], [72, 73], [77, 79], [136, 137], [169, 176], [190, 191]]],
  [10, [[0, 0], [21, 21], [23, 23], [25, 25], [27, 27], [31, 31], [54, 55], [122, 123], [136, 137], [160, 176], [190, 191]]],
  [11, [[0, 0], [19, 19], [21, 21], [23, 23], [25, 25], [27, 27], [31, 31], [33, 33], [54, 55], [122, 123], [134, 137], [160, 176], [190, 191]]],
  [12, [[0, 0], [19, 19], [21, 21], [23, 23], [25, 25], [27, 27], [31, 31], [33, 33], [122, 123], [133, 137], [160, 176], [190, 191]]],
  [13, [[0, 79], [83, 119], [122, 123], [126, 137], [145, 152], [160, 191]]],
  [14, [[0, 79], [83, 119], [122, 123], [126, 137], [145, 152], [160, 191]]],
]);

export const WORLD_1_2_QUESTION_BLOCKS = Object.freeze([
  { x: 10, y: 9, reward: "mushroom" },
  { x: 11, y: 9, reward: "coin" },
  { x: 12, y: 9, reward: "coin" },
  { x: 13, y: 9, reward: "coin" },
  { x: 14, y: 9, reward: "coin" },
]);

export const WORLD_1_2_REWARD_BLOCKS = Object.freeze([
  { id: "ten-coin-a", x: 29, y: 8, reward: "multiCoin" },
  { id: "star", x: 46, y: 7, reward: "star" },
  { id: "power-a", x: 69, y: 8, reward: "mushroom" },
  { id: "ten-coin-b", x: 73, y: 8, reward: "multiCoin" },
  { id: "hidden-one-up", x: 83, y: 9, reward: "oneUp", hidden: true },
  { id: "power-b", x: 150, y: 8, reward: "mushroom" },
]);

export const WORLD_1_2_LOOSE_COINS = Object.freeze([
  [41, 5], [42, 5], [43, 5], [44, 5],
  [84, 5], [85, 5], [86, 5], [87, 5], [88, 5], [89, 5],
  [40, 8], [45, 8], [58, 8], [59, 8], [60, 8], [61, 8], [68, 8],
]);

export const WORLD_1_2_BONUS_COINS = Object.freeze([
  [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
  [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
]);

export const WORLD_1_2_BONUS_MULTICOIN_BLOCK = Object.freeze({ x: 6, y: 6, reward: "multiCoin" });

export const WORLD_1_2_PIPES = Object.freeze([
  { id: "bonus-entry", x: 103, top: 9, destination: "bonus" },
  { id: "middle", x: 109, top: 8 },
  { id: "bonus-return", x: 115, top: 10, destination: "main" },
  { id: "warp-4", x: 178, top: 10 },
  { id: "warp-3", x: 182, top: 10 },
  { id: "warp-2", x: 186, top: 10 },
]);

export const WORLD_1_2_MOVING_PLATFORMS = Object.freeze([
  { id: "lift-a-top", x: 139, width: 4, top: 6, bottom: 12, phase: 0 },
  { id: "lift-a-bottom", x: 139, width: 4, top: 6, bottom: 12, phase: Math.PI },
  { id: "lift-b-top", x: 154, width: 4, top: 4, bottom: 12, phase: 0 },
  { id: "lift-b-bottom", x: 154, width: 4, top: 4, bottom: 12, phase: Math.PI },
]);

export const WORLD_1_2_GOOMBAS = Object.freeze([
  { x: 16, top: 13 }, { x: 17, top: 13 }, { x: 29, top: 13 },
  { x: 62, top: 13 }, { x: 64, top: 13 }, { x: 73, top: 5 },
  { x: 76, top: 9 }, { x: 99, top: 13 }, { x: 100, top: 13 },
  { x: 102, top: 13 }, { x: 113, top: 13 }, { x: 114, top: 13 },
  { x: 146, top: 13 }, { x: 147, top: 13 },
]);

export const WORLD_1_2_KOOPAS = Object.freeze([
  { x: 44, top: 13, kind: "koopa" },
  { x: 59, top: 13, kind: "koopa" },
  { x: 95, top: 13, kind: "koopa" },
  { x: 150, top: 13, kind: "redkoopa" },
]);

export function getWorld12Transition(input) {
  if (input.cooldown > 0) return null;
  const close = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;

  if (input.area === "entry" && input.down && input.grounded
    && close(input.centerTile, WORLD_1_2_MAP.entryPipe + 1, 0.8)
    && close(input.bottomRow, 10, 0.3)) return "enter-main";

  if (input.area === "main" && input.down && input.grounded
    && close(input.centerTile, WORLD_1_2_MAP.mainStart + WORLD_1_2_MAP.bonusEntryPipe + 1, 0.8)
    && close(input.bottomRow, 9, 0.3)) return "enter-bonus";

  if (input.area === "bonus" && input.down && input.grounded
    && close(input.centerTile, WORLD_1_2_MAP.bonusStart + WORLD_1_2_MAP.bonusExitPipe + 1, 0.8)
    && close(input.bottomRow, 9, 0.3)) return "return-main";

  if (input.area === "main" && input.right
    && input.rightTile >= WORLD_1_2_MAP.mainStart + WORLD_1_2_MAP.normalExitPipe - 0.4
    && input.rightTile <= WORLD_1_2_MAP.mainStart + WORLD_1_2_MAP.normalExitPipe + 0.4
    && input.bottomRow > 8.2 && input.topRow < 10.2) return "enter-exit";

  return null;
}
