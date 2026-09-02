#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

// Writes one changeset per commit since BASE_REF so every commit gets its own line in
// CHANGELOG.md and the GitHub release notes. Changesets are never committed to the repo — the
// release workflow generates them here and `changeset version` consumes them in the same run.
// Merge commits, release commits, and commits that touch nothing publishable are skipped.

const PACKAGE_NAME = '@colordx/core';
const REPO_URL = 'https://github.com/dkryaklin/colordx';
const VALID_BUMPS = new Set(['major', 'minor', 'patch']);

// Caller decides the bump; AI only writes the summaries.
const BUMP = process.env.BUMP;
// Ref to diff against (last release tag, branch name, or SHA).
const BASE_REF = process.env.BASE_REF ?? process.env.BASE_BRANCH ?? 'main';
// DRY_RUN=1 skips the API and derives each note from the commit subject — for local testing.
const DRY_RUN = process.env.DRY_RUN === '1';

// Paths that actually ship to npm or affect the built artifact.
const PUBLISHABLE_PATHS = ['src', 'package.json', 'README.md', 'tsup.config.ts'];
const MAX_DIFF_CHARS = 60_000;
const SKIP_TOKEN = 'SKIP';

type Commit = { sha: string; short: string; subject: string; body: string };

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function listCommits(): Commit[] {
  // Oldest first so the changelog reads chronologically; merges carry no content of their own.
  const out = git('log', '--reverse', '--no-merges', '--format=%H%x1f%h%x1f%s%x1f%b%x1e', `${BASE_REF}..HEAD`);
  return out
    .split('\x1e')
    .map((rec) => rec.trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha = '', short = '', subject = '', body = ''] = rec.split('\x1f');
      return { sha, short, subject: subject.trim(), body: body.trim() };
    });
}

const changedFiles = (sha: string): string[] =>
  git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean);

const isPublishable = (file: string): boolean => PUBLISHABLE_PATHS.some((p) => file === p || file.startsWith(`${p}/`));

function commitDiff(sha: string): string {
  const diff = git('show', '--format=', '--no-color', sha, '--', ...PUBLISHABLE_PATHS);
  return diff.length > MAX_DIFF_CHARS ? `${diff.slice(0, MAX_DIFF_CHARS)}\n…[diff truncated]` : diff;
}

/** Fallback used by DRY_RUN: "feat: add X" → "Add X". */
function summaryFromSubject(subject: string): string {
  const stripped = subject.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').replace(/\.$/, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

async function summarize(client: Anthropic, commit: Commit): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: `Write a single-line changelog entry for one commit to ${PACKAGE_NAME}.

Rules:
- Present tense, imperative ("Add X", "Fix Y", not "Added" / "Fixes")
- Be specific about user-visible changes (e.g. "Add support for oklch none keyword in string parsing" not "Update source files")
- Name the API methods, formats, or behaviors that changed; mention migration steps if the change is breaking
- If the commit has no user-visible effect (internal refactor, docs typo, tooling), respond with exactly ${SKIP_TOKEN}
- One line, no markdown, no quotes, no trailing period

Commit subject:
${commit.subject}

Commit body:
${commit.body || '(none)'}

Diff of publishable files (${PUBLISHABLE_PATHS.join(', ')}):
${commitDiff(commit.sha)}

Respond with the changelog line only.`,
      },
    ],
  });
  if (response.stop_reason === 'refusal') throw new Error(`Refused while summarizing ${commit.short}`);
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text.trim() ?? '';
  if (!text) throw new Error(`AI returned empty summary for ${commit.short}`);
  return text;
}

async function main() {
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

  const client = DRY_RUN ? null : new Anthropic();
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

    const summary = client ? await summarize(client, commit) : summaryFromSubject(commit.subject);
    if (summary === SKIP_TOKEN) {
      console.log(`skip  ${commit.short}  ${commit.subject}  (no user-visible change)`);
      continue;
    }

    // Zero-padded index keeps changesets in commit order when the CLI reads the directory.
    const filename = `ai-${String(i + 1).padStart(3, '0')}-${commit.short}.md`;
    const line = `${summary} ([${commit.short}](${REPO_URL}/commit/${commit.sha}))`;
    writeFileSync(join(changesetDir, filename), `---\n"${PACKAGE_NAME}": ${BUMP}\n---\n\n${line}\n`);
    written++;
    console.log(`write ${commit.short}  ${filename}\n      ${line}`);
  }

  console.log(`\n${written} changeset(s) written, bump: ${BUMP}${DRY_RUN ? ' (dry run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
