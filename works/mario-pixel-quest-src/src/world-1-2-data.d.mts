export type World12Reward = "coin" | "multiCoin" | "mushroom" | "star" | "oneUp";
export type World12Area = "entry" | "main" | "bonus" | "exit";

export const WORLD_1_2_MAP: Readonly<{
  mainStart: number;
  entryPipe: number;
  bonusEntryPipe: number;
  bonusReturnPipe: number;
  normalExitPipe: number;
  exitStart: number;
  bonusStart: number;
  bonusExitPipe: number;
}>;

export const WORLD_1_2_STATIC_RUNS: ReadonlyArray<readonly [number, ReadonlyArray<readonly [number, number]>]>;
export const WORLD_1_2_QUESTION_BLOCKS: ReadonlyArray<Readonly<{ x: number; y: number; reward: World12Reward }>>;
export const WORLD_1_2_REWARD_BLOCKS: ReadonlyArray<Readonly<{ id: string; x: number; y: number; reward: World12Reward; hidden?: boolean }>>;
export const WORLD_1_2_LOOSE_COINS: ReadonlyArray<readonly [number, number]>;
export const WORLD_1_2_BONUS_COINS: ReadonlyArray<readonly [number, number]>;
export const WORLD_1_2_BONUS_MULTICOIN_BLOCK: Readonly<{ x: number; y: number; reward: "multiCoin" }>;
export const WORLD_1_2_PIPES: ReadonlyArray<Readonly<{ id: string; x: number; top: number; destination?: string }>>;
export const WORLD_1_2_MOVING_PLATFORMS: ReadonlyArray<Readonly<{ id: string; x: number; width: number; top: number; bottom: number; phase: number }>>;
export const WORLD_1_2_GOOMBAS: ReadonlyArray<Readonly<{ x: number; top: number }>>;
export const WORLD_1_2_KOOPAS: ReadonlyArray<Readonly<{ x: number; top: number; kind: "koopa" | "redkoopa" }>>;

export function getWorld12Transition(input: {
  area: World12Area;
  cooldown: number;
  down: boolean;
  right: boolean;
  grounded: boolean;
  centerTile: number;
  rightTile: number;
  topRow: number;
  bottomRow: number;
}): "enter-main" | "enter-bonus" | "return-main" | "enter-exit" | null;
