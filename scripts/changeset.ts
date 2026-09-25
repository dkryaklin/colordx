#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Writes one changeset per commit since BASE_REF so every commit gets its own line in
// CHANGELOG.md and the GitHub release notes. Changesets are never committed to the repo — the
// release workflow generates them here and `changeset version` consumes them in the same run.
// Each note is the commit subject with its conventional-commit prefix stripped. Merge commits,
// release commits, and commits that touch nothing publishable are skipped.

const PACKAGE_NAME = '@colordx/core';
const REPO_URL = 'https://github.com/dkryaklin/colordx';
const VALID_BUMPS = new Set(['major', 'minor', 'patch']);

// Caller decides the bump.
const BUMP = process.env.BUMP;
// Ref to diff against (last release tag, branch name, or SHA).
const BASE_REF = process.env.BASE_REF ?? process.env.BASE_BRANCH ?? 'main';

// Paths that actually ship to npm or affect the built artifact.
const PUBLISHABLE_PATHS = ['src', 'package.json', 'README.md', 'tsup.config.ts'];

type Commit = { sha: string; short: string; subject: string };

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function listCommits(): Commit[] {
  // Oldest first so the changelog reads chronologically; merges carry no content of their own.
  const out = git('log', '--reverse', '--no-merges', '--format=%H%x1f%h%x1f%s%x1e', `${BASE_REF}..HEAD`);
  return out
    .split('\x1e')
    .map((rec) => rec.trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha = '', short = '', subject = ''] = rec.split('\x1f');
      return { sha, short, subject: subject.trim() };
    });
}

const changedFiles = (sha: string): string[] =>
  git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean);

const isPublishable = (file: string): boolean => PUBLISHABLE_PATHS.some((p) => file === p || file.startsWith(`${p}/`));

/** "feat(scope)!: add X." → "Add X". */
function summaryFromSubject(subject: string): string {
  const stripped = subject.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').replace(/\.$/, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function main() {
  if (!BUMP || !VALID_BUMPS.has(BUMP)) {
    throw new Error(`BUMP env must be one of: ${[...VALID_BUMPS].join(', ')} (got "${BUMP}")`);
  }

  const commits = listCommits();
  if (commits.length === 0) {
    console.log(`No commits since ${BASE_REF}.`);
    return;
  }

  const changesetDir = join(process.cwd(), '.changeset');
  if (!existsSync(changesetDir)) mkdirSync(changesetDir);

  let written = 0;

  for (const [i, commit] of commits.entries()) {
    const files = changedFiles(commit.sha);
    let skip: string | null = null;
    if (/^chore: release/.test(commit.subject)) skip = 'release commit';
    else if (!files.some(isPublishable)) skip = 'no publishable files';
    if (skip) {
      console.log(`skip  ${commit.short}  ${commit.subject}  (${skip})`);
      continue;
    }

    // Zero-padded index keeps changesets in commit order when the CLI reads the directory.
    const filename = `commit-${String(i + 1).padStart(3, '0')}-${commit.short}.md`;
    const line = `${summaryFromSubject(commit.subject)} ([${commit.short}](${REPO_URL}/commit/${commit.sha}))`;
    writeFileSync(join(changesetDir, filename), `---\n"${PACKAGE_NAME}": ${BUMP}\n---\n\n${line}\n`);
    written++;
    console.log(`write ${commit.short}  ${filename}\n      ${line}`);
  }

  console.log(`\n${written} changeset(s) written, bump: ${BUMP}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
