import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Wang Jian protection frame uses sprite bounds after canvas flip is restored", async () => {
  const source = await readFile(new URL("../src/Game.tsx", import.meta.url), "utf8");

  assert.match(source, /type Character = "mario" \| "wangjian"/);
  assert.match(source, /ctx\.restore\(\);\s*if \(player\.powered\) \{[\s\S]*?ctx\.strokeRect\(x - 4, y - 4, width \+ 8, height \+ 8\);/);
  assert.match(source, /const PLAYER_HEIGHT = TILE;/);
  assert.match(source, /const height = player\.h;/);
  assert.doesNotMatch(source, /character === "business"/);
});
