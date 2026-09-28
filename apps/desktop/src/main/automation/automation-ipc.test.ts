import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { AUTOMATION_IPC } from "@tellann/desktop-contracts";

// The preload runs sandboxed and cannot import the contracts, so it repeats the channel names. A name that drifted
// would not fail to compile: the button would simply do nothing. This is what notices.
const preload = fs.readFileSync(path.join(__dirname, "../../../../src/preload/preload.ts"), "utf8");

test("the preload's automation channels are exactly the contract's", () => {
  const block = /const AUTOMATION_IPC = \{([\s\S]*?)\} as const;/.exec(preload);
  assert.ok(block, "the preload declares AUTOMATION_IPC");
  const declared = Object.fromEntries([...block![1]!.matchAll(/(\w+):\s*'([^']+)'/g)].map((match) => [match[1], match[2]]));
  assert.deepEqual(declared, AUTOMATION_IPC);
});

test("every automation channel has a handler in the main process and a method in the preload", () => {
  const main = fs.readFileSync(path.join(__dirname, "../../../../src/main/main.ts"), "utf8");
  for (const name of Object.keys(AUTOMATION_IPC)) {
    if (name === "statusChanged") continue; // sent by the main process, not handled
    assert.ok(main.includes(`AUTOMATION_IPC.${name},`), `main handles ${name}`);
    assert.ok(preload.includes(`AUTOMATION_IPC.${name}`), `the preload sends ${name}`);
  }
  assert.ok(main.includes("AUTOMATION_IPC.statusChanged") && preload.includes("AUTOMATION_IPC.statusChanged"));
});
