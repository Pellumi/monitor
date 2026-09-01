import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Runs git with an argv array (never a shell) and a deliberately minimal
 * environment, so a hostile repository cannot influence the invocation through
 * inherited GIT_* variables or a poisoned PATH entry.
 */
export async function runGit(root: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      // Never let git stop for credentials or an editor inside the desktop app.
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
    },
  });
  return String(result.stdout ?? '').trim();
}

/** Same as runGit, but a non-zero exit becomes null instead of throwing. */
export async function tryGit(root: string, args: string[]): Promise<string | null> {
  try {
    return await runGit(root, args);
  } catch {
    return null;
  }
}
