import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { extractTarGz } from './tar.js';
import {
  BUNDLED_TEMPLATES_DIR,
  SIBLING_TEMPLATES_DIR,
} from './templates.js';

export const TEMPLATES_REPO = 'Soro-Bix/soroban-scaffold-templates';
const GITHUB_API_BASE = 'https://api.github.com';

export type FileChangeKind = 'added' | 'modified' | 'removed';

export interface TemplateFileDiff {
  template: string;
  relativePath: string;
  kind: FileChangeKind;
  addedLines: number;
  removedLines: number;
}

export interface TemplateSummaryDiff {
  template: string;
  added: number;
  modified: number;
  removed: number;
  unchanged: number;
}

export interface TemplateTreeDiff {
  files: TemplateFileDiff[];
  templates: TemplateSummaryDiff[];
  hasChanges: boolean;
}

export interface FetchedTemplates {
  version: string;
  sourceUrl: string;
  stagingRoot: string;
  templatesDir: string;
  cleanup: () => Promise<void>;
}

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

/**
 * Resolves the local directory that `sorobix upgrade` should write templates
 * into. Honors an explicit argument or `SOROBIX_TEMPLATES_DIR`, then prefers an
 * existing bundled or sibling directory, and defaults to `BUNDLED_TEMPLATES_DIR`
 * so a fresh install or checkout immediately resolves upgraded templates.
 */
export function resolveUpgradeTargetDir(explicitDir?: string): string {
  if (explicitDir && explicitDir.trim()) {
    return explicitDir.trim();
  }

  const override = process.env.SOROBIX_TEMPLATES_DIR;
  if (override && override.trim()) {
    return override.trim();
  }

  if (fs.existsSync(BUNDLED_TEMPLATES_DIR)) {
    return BUNDLED_TEMPLATES_DIR;
  }

  if (fs.existsSync(SIBLING_TEMPLATES_DIR)) {
    return SIBLING_TEMPLATES_DIR;
  }

  return BUNDLED_TEMPLATES_DIR;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': '@soro-bix/scaffold-cli',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJsonOrThrow(
  fetchImpl: FetchLike,
  url: string
): Promise<{ status: number; data: unknown }> {
  let response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Network error while contacting GitHub (${url}): ${detail}. Check your internet connection and try again.`
    );
  }

  if (response.status === 404) {
    return { status: 404, data: null };
  }

  if (!response.ok) {
    const rateHint =
      response.status === 403 || response.status === 429
        ? ' (GitHub API rate limit may have been reached; set GITHUB_TOKEN to authenticate)'
        : '';
    throw new Error(
      `Failed to query latest templates from GitHub: HTTP ${response.status} ${response.statusText}${rateHint}`
    );
  }

  return { status: response.status, data: await response.json() };
}

/**
 * Resolves the latest release metadata for `Soro-Bix/soroban-scaffold-templates`,
 * falling back to the `main` branch head when no GitHub Release has been published.
 */
export async function resolveLatestArchiveSource(
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  repo: string = TEMPLATES_REPO
): Promise<{ version: string; tarballUrl: string }> {
  const latestReleaseUrl = `${GITHUB_API_BASE}/repos/${repo}/releases/latest`;
  const releaseResp = await fetchJsonOrThrow(fetchImpl, latestReleaseUrl);

  if (releaseResp.status !== 404 && releaseResp.data && typeof releaseResp.data === 'object') {
    const record = releaseResp.data as Record<string, unknown>;
    const tag = typeof record.tag_name === 'string' ? record.tag_name.trim() : '';
    const tarballUrl = typeof record.tarball_url === 'string' ? record.tarball_url.trim() : '';
    if (tag && tarballUrl) {
      return { version: tag, tarballUrl };
    }
  }

  // Fallback when the templates repository has not cut a formal GitHub Release yet.
  const mainCommitUrl = `${GITHUB_API_BASE}/repos/${repo}/commits/main`;
  const commitResp = await fetchJsonOrThrow(fetchImpl, mainCommitUrl);
  if (commitResp.status === 404 || !commitResp.data || typeof commitResp.data !== 'object') {
    throw new Error(
      `Could not locate a release or main branch for ${repo} on GitHub.`
    );
  }

  const sha = typeof (commitResp.data as Record<string, unknown>).sha === 'string'
    ? ((commitResp.data as Record<string, unknown>).sha as string).slice(0, 7)
    : 'latest';

  return {
    version: `main@${sha}`,
    tarballUrl: `${GITHUB_API_BASE}/repos/${repo}/tarball/main`,
  };
}

/**
 * Downloads and extracts the latest templates archive into a temporary staging
 * directory so callers can inspect the diff before modifying local files.
 */
export async function fetchLatestTemplates(
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  repo: string = TEMPLATES_REPO
): Promise<FetchedTemplates> {
  const { version, tarballUrl } = await resolveLatestArchiveSource(fetchImpl, repo);

  let archiveResp;
  try {
    archiveResp = await fetchImpl(tarballUrl, { headers: githubHeaders() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Network error while downloading template archive (${tarballUrl}): ${detail}`
    );
  }

  if (!archiveResp.ok) {
    throw new Error(
      `Failed to download template archive (${version}): HTTP ${archiveResp.status} ${archiveResp.statusText}`
    );
  }

  const bytes = Buffer.from(await archiveResp.arrayBuffer());
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-upgrade-'));
  const cleanup = async () => {
    await fs.remove(stagingRoot);
  };

  try {
    await extractTarGz(bytes, stagingRoot, 1);
    const templatesDir = path.join(stagingRoot, 'templates');
    if (!(await fs.pathExists(templatesDir))) {
      throw new Error(
        `Downloaded archive (${version}) does not contain a templates/ directory.`
      );
    }
    return {
      version,
      sourceUrl: tarballUrl,
      stagingRoot,
      templatesDir,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function listRelativeFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  if (!(await fs.pathExists(dir))) {
    return files;
  }

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const rel = path.relative(dir, fullPath).split(path.sep).join('/');
        const content = await fs.readFile(fullPath, 'utf-8');
        files.set(rel, content);
      }
    }
  }

  await walk(dir);
  return files;
}

async function listSubdirectories(dir: string): Promise<string[]> {
  if (!(await fs.pathExists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function countLineDelta(before: string, after: string): { addedLines: number; removedLines: number } {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);

  // Multiset frequency comparison keeps line-delta computation O(N) even on
  // large Cargo.lock.template files without blowing up an O(N*M) LCS matrix.
  const counts = new Map<string, number>();
  for (const line of oldLines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  let shared = 0;
  for (const line of newLines) {
    const remaining = counts.get(line) ?? 0;
    if (remaining > 0) {
      shared++;
      counts.set(line, remaining - 1);
    }
  }

  return {
    addedLines: newLines.length - shared,
    removedLines: oldLines.length - shared,
  };
}

/**
 * Computes a per-template and per-file diff summary between the currently
 * installed templates directory and a newly fetched templates directory.
 */
export async function diffTemplateTrees(
  currentDir: string,
  incomingDir: string
): Promise<TemplateTreeDiff> {
  const [currentTemplates, incomingTemplates] = await Promise.all([
    listSubdirectories(currentDir),
    listSubdirectories(incomingDir),
  ]);

  const allTemplateNames = Array.from(
    new Set([...currentTemplates, ...incomingTemplates])
  ).sort();

  const files: TemplateFileDiff[] = [];
  const templates: TemplateSummaryDiff[] = [];

  for (const template of allTemplateNames) {
    const [oldMap, newMap] = await Promise.all([
      listRelativeFiles(path.join(currentDir, template)),
      listRelativeFiles(path.join(incomingDir, template)),
    ]);

    const allRelPaths = Array.from(
      new Set([...oldMap.keys(), ...newMap.keys()])
    ).sort();

    let added = 0;
    let modified = 0;
    let removed = 0;
    let unchanged = 0;

    for (const relPath of allRelPaths) {
      const oldContent = oldMap.get(relPath);
      const newContent = newMap.get(relPath);

      if (oldContent === undefined && newContent !== undefined) {
        added++;
        files.push({
          template,
          relativePath: `${template}/${relPath}`,
          kind: 'added',
          addedLines: splitLines(newContent).length,
          removedLines: 0,
        });
      } else if (oldContent !== undefined && newContent === undefined) {
        removed++;
        files.push({
          template,
          relativePath: `${template}/${relPath}`,
          kind: 'removed',
          addedLines: 0,
          removedLines: splitLines(oldContent).length,
        });
      } else if (oldContent !== undefined && newContent !== undefined) {
        const normalizedOld = oldContent.replace(/\r\n/g, '\n');
        const normalizedNew = newContent.replace(/\r\n/g, '\n');
        if (normalizedOld === normalizedNew) {
          unchanged++;
        } else {
          modified++;
          const { addedLines, removedLines } = countLineDelta(normalizedOld, normalizedNew);
          files.push({
            template,
            relativePath: `${template}/${relPath}`,
            kind: 'modified',
            addedLines,
            removedLines,
          });
        }
      }
    }

    templates.push({ template, added, modified, removed, unchanged });
  }

  return {
    files,
    templates,
    hasChanges: files.length > 0,
  };
}

/**
 * Replaces the template subdirectories in `targetDir` with the contents of
 * `incomingDir`.
 */
export async function installFetchedTemplates(
  incomingDir: string,
  targetDir: string
): Promise<string[]> {
  await fs.ensureDir(targetDir);
  const incomingTemplates = await listSubdirectories(incomingDir);
  const existingTemplates = await listSubdirectories(targetDir);
  const incomingSet = new Set(incomingTemplates);

  // Remove template directories that were deleted upstream.
  for (const existing of existingTemplates) {
    if (!incomingSet.has(existing)) {
      await fs.remove(path.join(targetDir, existing));
    }
  }

  // Replace each incoming template cleanly so removed files do not linger.
  for (const template of incomingTemplates) {
    const destTemplateDir = path.join(targetDir, template);
    await fs.remove(destTemplateDir);
    await fs.copy(path.join(incomingDir, template), destTemplateDir);
  }

  return incomingTemplates;
}
