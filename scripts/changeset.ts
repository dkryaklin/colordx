#!/usr/bin/env tsx
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_NAME = '@colordx/core';
const BASE_BRANCH = process.env.BASE_BRANCH ?? 'main';

// SHA refs (direct push) don't need origin/ prefix; branch names do
const baseRef = /^[0-9a-f]{7,40}$/.test(BASE_BRANCH) ? BASE_BRANCH : `origin/${BASE_BRANCH}`;

function getGitDiff(): string {
  try {
    const diff = execSync(
      `git diff ${baseRef}...HEAD -- ':(exclude)*.lock' ':(exclude).yarn'`,
      { encoding: 'utf8' },
    );
    return diff.slice(0, 8000);
  } catch {
    return '';
  }
}

function getCommits(): string {
  try {
    return execSync(`git log ${baseRef}...HEAD --pretty=format:"%s"`, { encoding: 'utf8' });
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
        content: `Analyze these changes to the ${PACKAGE_NAME} npm library and determine:
1. Whether a release is needed and what semver bump type:
   - "major" — breaking changes to the public API
   - "minor" — new features, backwards compatible
   - "patch" — bug fixes
   - "none" — no release needed (CI, docs, tests, refactor, tooling changes only)
2. A concise one-sentence changelog summary (can be empty string if bump is "none")

Commit messages:
${commits}

Git diff (excludes lock files):
${diff}

Respond with JSON only, no markdown:
{"bump": "major|minor|patch|none", "summary": "..."}`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const { bump, summary } = JSON.parse(text) as { bump: string; summary: string };

  if (bump === 'none') {
    console.log('No release needed for this PR.');
    return;
  }

  const content = `---\n"${PACKAGE_NAME}": ${bump}\n---\n\n${summary}\n`;
  const filename = join(process.cwd(), '.changeset', `${randomName()}.md`);

  writeFileSync(filename, content);
  console.log(`Created: ${filename}`);
  console.log(`Bump: ${bump}`);
  console.log(`Summary: ${summary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
