import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { isAlive, killProcessTree } from "./process-tree";

const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleepMs(50);
  }
  return check();
}

/** A parent process that starts a long-lived grandchild and reports the grandchild's pid: the shape of `npm run dev`. */
function startTree(): Promise<{ parentPid: number; childPid: number; cleanup: () => void }> {
  const script = `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    console.log('CHILD:' + child.pid);
    setInterval(() => {}, 1000);
  `;
  const parent = spawn(process.execPath, ["-e", script], {
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  return new Promise((resolve, reject) => {
    let buffer = "";
    parent.stdout!.on("data", (chunk) => {
      buffer += String(chunk);
      const match = /CHILD:(\d+)/.exec(buffer);
      if (match) {
        resolve({
          parentPid: parent.pid!,
          childPid: Number(match[1]),
          cleanup: () => {
            for (const pid of [Number(match[1]), parent.pid!]) {
              try { process.kill(pid, "SIGKILL"); } catch { /* gone */ }
            }
          },
        });
      }
    });
    parent.once("error", reject);
  });
}

test("ending a process ends what it started, not only the process itself (real processes)", async () => {
  const tree = await startTree();
  try {
    assert.equal(isAlive(tree.parentPid), true);
    assert.equal(isAlive(tree.childPid), true, "the grandchild is running before we start");
    await killProcessTree(tree.parentPid, { graceMs: 2_000 });
    assert.equal(await waitFor(() => !isAlive(tree.parentPid)), true, "the parent is gone");
    assert.equal(await waitFor(() => !isAlive(tree.childPid)), true, "and so is the grandchild that would otherwise hold the port");
  } finally {
    tree.cleanup();
  }
});

test("killing a process that has already exited is not an error", async () => {
  const done = spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => done.once("exit", resolve));
  await killProcessTree(done.pid!, { graceMs: 200 });
});

test("pids that would take out the whole machine or our own group are refused", async () => {
  const sent: Array<[number, unknown]> = [];
  for (const pid of [0, 1, -5, 1.5, Number.NaN]) {
    await killProcessTree(pid, { platform: "linux", signal: (target, name) => { sent.push([target, name]); }, taskkill: async () => { sent.push([pid, "taskkill"]); } });
  }
  assert.deepEqual(sent, []);
});

test("on Windows the whole tree is ended with taskkill", async () => {
  const calls: number[] = [];
  await killProcessTree(4242, { platform: "win32", taskkill: async (pid) => { calls.push(pid); } });
  assert.deepEqual(calls, [4242]);
});

test("elsewhere a group leader's whole group is signalled: politely first, then forced if it is still there", async () => {
  const sent: Array<[number, unknown]> = [];
  let alive = true;
  await killProcessTree(500, {
    platform: "linux", graceMs: 300,
    signal: (target, name) => {
      sent.push([target, name]);
      if (name === 0 && !alive) throw Object.assign(new Error("gone"), { code: "ESRCH" });
    },
    sleep: async () => undefined,
  });
  assert.deepEqual(sent.filter(([, name]) => name !== 0), [[-500, "SIGTERM"], [-500, "SIGKILL"]], "group, then escalation");
  sent.length = 0;
  alive = false;
  await killProcessTree(500, {
    platform: "linux", graceMs: 300,
    signal: (target, name) => {
      sent.push([target, name]);
      if (name === 0) throw Object.assign(new Error("gone"), { code: "ESRCH" });
    },
    sleep: async () => undefined,
  });
  assert.deepEqual(sent.filter(([, name]) => name !== 0), [[-500, "SIGTERM"]], "no escalation once it has gone");
});

test("a process that was not started as a group leader is signalled on its own", async () => {
  const sent: Array<[number, unknown]> = [];
  await killProcessTree(500, { platform: "linux", group: false, graceMs: 100, signal: (target, name) => { sent.push([target, name]); if (name === 0) throw Object.assign(new Error("gone"), { code: "ESRCH" }); }, sleep: async () => undefined });
  assert.deepEqual(sent.find(([, name]) => name === "SIGTERM"), [500, "SIGTERM"]);
});

test("a process we may not signal counts as alive, not as gone", () => {
  assert.equal(isAlive(1234, () => { throw Object.assign(new Error("no"), { code: "EPERM" }); }), true);
  assert.equal(isAlive(1234, () => { throw Object.assign(new Error("no"), { code: "ESRCH" }); }), false);
});
