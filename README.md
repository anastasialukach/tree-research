# tree-research

Give AI a tree to climb, not a list to read.

```bash
npx tree-research init
```

One command. Installs a research protocol into your AI agent. Works with Claude Code, Cursor, Copilot, Windsurf — anything that reads project files.

## The problem

Ask any AI to "research X" and you'll get the same thing: a ranked list summarizing the first page of Google. It looks comprehensive. It's shallow.

We tested this. Gave Claude Code a detailed research prompt: map the VC podcast ecosystem, profile 500 guests, build a competitive analysis. It produced 118 guest profiles, 24 podcasts, a working web app with 9 tabs.

Then we audited it. 72 of 93 LinkedIn URLs were pattern-generated from first name + last name — never verified. 177 of 213 episode titles were generic ("Guest appearance on market dynamics"). 95 of 118 outreach hooks were made up. The AI graded itself a C+.

The same week, a human scrolled through the spreadsheet, clicked one unfamiliar name (Loulou Khazen Baz), followed her to her YouTube, found a guest who'd appeared 4 times with proprietary industry data, and discovered a platform that wasn't mentioned anywhere in the "research." Three clicks. More insight than 118 rows.

The AI wasn't broken. It was given a flat question and returned a flat answer.

## The fix

tree-research replaces "list and summarize" with "seed, map, branch, repeat" — the same loop Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) uses for ML experiments, applied to knowledge.

```
SEED → MAP → EVALUATE → DEEPEN → SYNTHESIZE → AUDIT
 5 diverse     map each      score        pick top 3     cross-branch    grade your
 entry points  world in      branches     threads, go    patterns,       own depth
               parallel      by surprise  one level      gaps, insights  honestly
                             + novelty    deeper
                                                         ↓
                                                    FRONTIER
                                                    seeds for next
                                                    session (research
                                                    compounds)
```

## Linear vs Tree

Same topic. Same AI. Same evening.

| | Linear | Tree |
|---|---|---|
| **What you ask** | "Research X" | "5 seeds, map each world, go deeper on surprises" |
| **Output** | Ranked list | Branch map with cross-connections |
| **Entities found** | 118 (surface-level) | 30 (with full context) |
| **Actionable insights** | 0 | 50 categorized |
| **Gaps found** | 0 | 4 major (most valuable findings) |
| **Data verified** | ~20% | ~85% |
| **Next session** | Start over | 32 frontier seeds carry forward |
| **Self-audit** | None | Honest scores per dimension |
| **What you learn** | What exists | What's missing + who's connected + where to go |

## Install

```bash
# Into your project
npx tree-research init

# As a Claude Code skill (available in all projects)
npx tree-research init --global

# Into Cursor rules
npx tree-research init --cursor
```

This creates:

```
.tree-research/
├── PROTOCOL.md          # Core protocol — your agent reads this
├── SKILL.md             # Skill definition for AI agents
├── config.json          # Settings (seeds, depth, parallelism)
├── templates/           # Branch file + session log templates
└── output/              # Where research lands
    ├── trees/           # One file per branch
    ├── insights.json    # Categorized, ranked insights
    ├── frontier.json    # Seeds for next session
    └── SESSION_LOG.md   # What happened + self-audit
```

## Usage

Open your AI agent and say:

```
Research the competitive landscape for AI writing tools using tree-research
```

Or for autonomous mode:

```
Run tree-research on "MENA VC ecosystem" — 5 seeds, 3 levels deep, autonomous
```

The agent reads PROTOCOL.md and follows the 6-phase protocol automatically.

## How it works

### Phase 1: SEED
Generate 5 diverse entry points. Not "top 5" — different angles. At least 2 seeds should require second-order searches to find. If Google page 1 returns all 5, your seeds are too obvious.

### Phase 2: MAP (parallel)
For each seed, map its entire world: adjacent entities, people, platforms, gaps. For every entity found, log one detail that wouldn't appear in a top-10 article. Run all seeds simultaneously — independent branches, unaware of each other.

### Phase 3: EVALUATE
Read all branches. Find cross-branch connections, gaps, and surprises. Score threads by novelty and connectivity. Pick the top 3 for Level 2. The data decides what's worth going deeper on — not a preset agenda.

### Phase 4: DEEPEN
Go one level deeper on selected threads. Focus on primary sources, specific numbers, real names. Map relationships between entities. Flag what you couldn't find.

### Phase 5: SYNTHESIZE
Cross-branch pattern detection. Categorize insights. Build the frontier — every unresolved thread becomes a seed for the next session.

### Phase 6: AUDIT
Grade yourself honestly: depth, specificity, gaps found, cross-branch patterns, frontier quality, honesty. If the score is below 60, say so. Shallow research that looks deep is worse than admitting it was shallow.

## The key ideas

**The data picks the next question.** Don't plan Level 2 before Level 1 finishes. What you find determines where you go.

**Gaps are findings.** "Nobody covers MENA sovereign wealth" (discovered across 5 independent branches) was more valuable than any single entity we found.

**Cross-branch patterns are the prize.** They only emerge from parallel, independent branches — no single thread reveals them.

**Frontier is compound interest.** Session 2 starts from Session 1's frontier. Research accumulates across sessions instead of resetting to zero.

**Audit is the difference.** autoresearch evaluates its own experiments. tree-research evaluates its own depth. Without the audit, you'll believe your own shallow output.

## Config

```json
{
  "seeds": 5,
  "max_depth": 3,
  "branches_per_level": 3,
  "parallel": true,
  "interactive": false,
  "audit_on_complete": true,
  "frontier_enabled": true,
  "output_format": "markdown"
}
```

Set `interactive: true` to choose Level 2 branches yourself instead of letting the agent decide.

## Inspired by

- [autoresearch](https://github.com/karpathy/autoresearch) by @karpathy — autonomous ML experiment loops. tree-research applies the same loop to knowledge: seed, evaluate, adjust, repeat. autoresearch optimizes a score. tree-research optimizes for surprise.
- The session that started it: a C+ AI research audit, one accidental click on an unfamiliar name, and the realization that AI doesn't explore — it fills in spreadsheets.

## License

MIT
