import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("surface courses complete through pole, castle walk, and raised castle flag", async () => {
  const source = await readFile(new URL("../src/Game.tsx", import.meta.url), "utf8");

  assert.match(source, /finishState: "none" \| "pole" \| "walk" \| "castleFlag"/);
  assert.match(source, /world\.finishState = "pole"/);
  assert.match(source, /world\.finishState = "walk"/);
  assert.match(source, /world\.finishState = "castleFlag"/);
  assert.match(source, /const flagY = 108 \+ flagProgress/);
  assert.match(source, /const castleFlagY = 424 - raise \* 92/);
  assert.match(source, /world\.finishState !== "castleFlag"/);
});
