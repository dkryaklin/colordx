#!/usr/bin/env tsx
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_NAME = '@colordx/core';
const VALID_BUMPS = new Set(['major', 'minor', 'patch']);

// Caller decides the bump; AI only writes the summary.
const BUMP = process.env.BUMP;
// Ref to diff against (last release tag, branch name, or SHA).
const BASE_REF = process.env.BASE_REF ?? process.env.BASE_BRANCH ?? 'main';

// Paths that actually ship to npm or affect the built artifact.
const PUBLISHABLE_PATHS = ['src', 'package.json', 'README.md', 'tsup.config.ts'];

function getGitDiff(): string {
  try {
    return execSync(
      `git diff ${BASE_REF}...HEAD -- ${PUBLISHABLE_PATHS.join(' ')}`,
      { encoding: 'utf8' },
    );
  } catch {
    return '';
  }
}

function getCommits(): string {
  try {
    return execSync(`git log ${BASE_REF}...HEAD --pretty=format:"%s"`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function hasExistingChangeset(): boolean {
  const changesetDir = join(process.cwd(), '.changeset');
  if (!existsSync(changesetDir)) return false;
  return readdirSync(changesetDir).some((f) => f.endsWith('.md') && f !== 'README.md');
}

function randomName(): string {
  const adjectives = ['happy', 'silly', 'brave', 'clever', 'swift', 'gentle', 'bright', 'calm'];
  const nouns = ['lion', 'tiger', 'panda', 'eagle', 'whale', 'bear', 'fox', 'wolf'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}-${noun}-${num}`;
}

async function main() {
  if (!BUMP || !VALID_BUMPS.has(BUMP)) {
    throw new Error(`BUMP env must be one of: ${[...VALID_BUMPS].join(', ')} (got "${BUMP}")`);
  }

  if (hasExistingChangeset()) {
    console.log('Changeset already exists, skipping.');
    return;
  }

  const diff = getGitDiff();
  const commits = getCommits();

  if (!diff && !commits) {
    console.log('No changes detected.');
    return;
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Write a single-line changelog entry for this release of ${PACKAGE_NAME}.

Rules:
- Present tense, imperative ("Add X", "Fix Y", not "Added" / "Fixes")
- Be specific about user-visible changes (e.g. "Add support for oklch none keyword in string parsing" not "Update source files")
- Ignore internal refactors unless they change behavior
- One line, no markdown, no quotes, no trailing period

Commit messages since last release:
${commits}

Git diff of publishable files (${PUBLISHABLE_PATHS.join(', ')}):
${diff}

Respond with the changelog line only.`,
      },
    ],
  });

  const summary = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  if (!summary) throw new Error('AI returned empty summary');

  const content = `---\n"${PACKAGE_NAME}": ${BUMP}\n---\n\n${summary}\n`;
  const filename = join(process.cwd(), '.changeset', `${randomName()}.md`);

  writeFileSync(filename, content);
  console.log(`Created: ${filename}`);
  console.log(`Bump: ${BUMP}`);
  console.log(`Summary: ${summary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
