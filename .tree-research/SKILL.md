# tree-research

Branching research protocol for AI agents. Replaces linear "list and summarize" research with tree-shaped exploration: seed, map, evaluate, deepen, synthesize, audit.

## When to activate

- User says "research [topic] using tree-research" or "run tree-research"
- User references the tree-research protocol
- User asks for deep research, ecosystem mapping, or competitive intelligence

## What to do

1. Read `PROTOCOL.md` in this directory — it contains the full 6-phase protocol
2. Read `config.json` for settings (seed count, depth, parallelism)
3. Follow the protocol exactly: SEED → MAP → EVALUATE → DEEPEN → SYNTHESIZE → AUDIT
4. Output goes to `output/` directory (trees, insights, frontier, session log)

## Key rules

- Do NOT produce ranked lists or summaries
- Run seeds in PARALLEL, not sequentially
- Level 2+ is decided AFTER Level 1 finishes — the data picks the next question
- Gaps (what's missing) are as valuable as discoveries (what's there)
- Cross-branch patterns only emerge from parallel independent branches
- Audit yourself honestly at the end — flag shallow work as shallow

## Output structure

```
output/
├── trees/           # One markdown file per branch
├── insights.json    # Categorized, ranked, actionable findings
├── frontier.json    # Seeds for next session (research compounds)
└── SESSION_LOG.md   # What happened, decisions made, self-audit
```
