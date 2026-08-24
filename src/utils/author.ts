import { execSync } from 'node:child_process';
import input from '@inquirer/input';

export const FALLBACK_AUTHOR = 'Unknown';

// `env` is explicit rather than read straight off process.env so callers (and
// tests) can control which git config layers are visible; git resolves
// user.name through GIT_CONFIG_GLOBAL/SYSTEM, which are env-driven.
export function readGitAuthor(env: NodeJS.ProcessEnv = process.env): string | null {
  try {
    const gitAuthor = execSync('git config user.name', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env,
    }).trim();

    return gitAuthor || null;
  } catch {
    // git not installed, or no user.name configured
    return null;
  }
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptForAuthor(): Promise<string> {
  const answer = await input({
    message: 'Author name for this project:',
    default: FALLBACK_AUTHOR,
  });

  return answer.trim() || FALLBACK_AUTHOR;
}

/**
 * Prompting is gated on an interactive TTY: a scaffold run inside CI or a
 * piped script would otherwise block forever waiting on stdin that never comes.
 */
export async function resolveAuthor(authorOption?: string): Promise<string> {
  if (authorOption && authorOption.trim()) {
    return authorOption.trim();
  }

  const gitAuthor = readGitAuthor();
  if (gitAuthor) {
    return gitAuthor;
  }

  if (isInteractive()) {
    return promptForAuthor();
  }

  return FALLBACK_AUTHOR;
}
