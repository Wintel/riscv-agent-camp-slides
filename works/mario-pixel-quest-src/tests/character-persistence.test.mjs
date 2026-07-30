import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("selected character is carried in world state across level changes", async () => {
  const source = await readFile(new URL("../src/Game.tsx", import.meta.url), "utf8");

  assert.match(source, /character: Character;/);
  assert.match(source, /function createWorld\([\s\S]*?character: Character = "mario"/);
  assert.match(source, /loadLevel\(next,[\s\S]*?current\.character\)/);
  assert.match(source, /worldRef\.current = createWorld\(index, stats, character\)/);
  assert.match(source, /drawWorld\(ctx, worldRef\.current, playerRef\.current, worldRef\.current\.character/);
  assert.match(source, /selectedCharacterRef\.current = character/);
});
