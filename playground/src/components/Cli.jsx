import { Terminal, Bot, ShieldCheck, FileJson } from 'lucide-react';
import { SectionHead, CodeBlock } from './ui.jsx';

const WORDS = [
  ['pair', 'one fg on one bg'],
  ['stack', 'fg, bg, and every bg behind it'],
  ['use', 'body, large, or ui'],
  ['gate', 'wcag, apca, or both'],
  ['result', 'pass, fail, warn, unpaired, skip'],
  ['fix', 'the nearest color that passes'],
];

export default function Cli() {
  return (
    <>
      <SectionHead
        icon={<Terminal size={13} />}
        eyebrow="CLI + agent skill"
        title="Check contrast in CI"
        desc="@colordx/cli checks, audits, and fixes contrast in your design tokens. It reads CSS, Tailwind, SCSS, and DTCG JSON. It also ships a Claude Code skill, so your agent runs the math instead of guessing."
      />
      <div className="cli-grid">
        <div className="cli-col">
          <h3 className="cli-h">
            <Terminal size={14} /> Install and try
          </h3>
          <CodeBlock code="npm install -D @colordx/cli" />
          <CodeBlock
            code={`npx colordx check '#777' '#fff'         # one pair
npx colordx audit src/globals.css       # every known pair
npx colordx scale '#3b82f6'             # a ramp, 50 to 950
npx colordx theme --primary '#3b82f6'   # shadcn roles`}
          />
          <p className="cli-p">
            Every command prints JSON, one record per pair. Add <code>--format table</code> for a human view. Exit code is 1 on any fail.
          </p>
          <CodeBlock
            lang="json"
            code={`{
  "fgToken": "--muted-foreground",
  "bgToken": "--muted",
  "wcag": { "ratio": 4.47, "min": 4.5, "pass": false },
  "apca": { "lc": 71.1, "min": 75, "pass": false },
  "result": "fail",
  "fix": "#777677",
  "source": { "file": "src/globals.css", "line": 17 }
}`}
          />
        </div>
        <div className="cli-col">
          <h3 className="cli-h">
            <Bot size={14} /> Skill for Claude Code
          </h3>
          <CodeBlock
            code={`claude plugin marketplace add dkryaklin/colordx-a11y
claude plugin install colordx-a11y@colordx`}
          />
          <p className="cli-p">
            The skill has the rules. The CLI has the math. A hook runs <code>audit</code> after every token edit and hands the result back to the model.
          </p>
          <p className="cli-p">Codex, Cursor, or any agent that reads SKILL.md:</p>
          <CodeBlock code="npx skills add dkryaklin/colordx-a11y" />

          <h3 className="cli-h">
            <ShieldCheck size={14} /> One step in CI
          </h3>
          <CodeBlock code="- run: npx @colordx/cli audit --strict" />
          <p className="cli-p">
            <code>--strict</code> also fails on warn and unpaired. Files, presets, and skips live in <code>colordx.config.json</code>.
          </p>

          <h3 className="cli-h">
            <FileJson size={14} /> Words
          </h3>
          <div className="words">
            {WORDS.map(([w, m]) => (
              <div key={w} className="word">
                <code>{w}</code>
                <span>{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cli-links">
        <a href="https://github.com/dkryaklin/colordx-a11y" target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
        <a href="https://www.npmjs.com/package/@colordx/cli" target="_blank" rel="noopener noreferrer">
          npm ↗
        </a>
        <a href="https://github.com/dkryaklin/colordx-a11y#readme" target="_blank" rel="noopener noreferrer">
          Full docs ↗
        </a>
      </div>
    </>
  );
}
