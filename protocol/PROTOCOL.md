# Tree Research Protocol

> Installed by `npx tree-research init`
> This file tells your AI agent how to research. It reads this automatically.

You are running tree-research. Follow this protocol exactly.
Do NOT produce ranked lists. Do NOT summarize search results.
You are mapping an ecosystem, not answering a question.

## When to activate

When the user says any of:
- "Research [topic] using tree-research"
- "Run tree-research on [topic]"
- "Tree-research: [topic]"
- Or references this protocol by name

Read `config.json` for settings. Output goes to `output/`.

---

## Phase 1: SEED (2 minutes)

Given the user's topic, generate `seeds` (default: 5) diverse entry points.

**Rules for seed selection:**
- Seeds must be DIVERSE — different angles into the space, not "top N"
- One seed: the obvious market leader or central entity
- One seed: a niche/underdog player or overlooked corner
- One seed: from an adjacent market or ecosystem
- One seed: the newest entrant or most recent development
- One seed: the most contrarian or unexpected angle

**Output:** List each seed with a one-sentence reason it was chosen.

**Anti-pattern:** Do NOT pick 5 entities from the same "top 10 list." If a Google search for the topic would return all 5 seeds on page 1, your seeds are too obvious. At least 2 seeds should require a second-order search to find.

---

## Phase 2: MAP (Level 1) — run in parallel

For EACH seed, create a branch file using the template in `templates/TREE_TEMPLATE.md`.

**The mapping prompt for each seed:**

1. What is this entity's full world? Products, people, platforms, adjacent entities.
2. For each adjacent entity, find ONE specific detail that would NOT appear in a generic top-10 article about this space.
3. What's surprising? What did you expect to find but didn't?
4. What's MISSING? Gaps matter as much as discoveries.
5. Flag the 3 threads most worth going deeper on.
6. Flag any connections to OTHER seeds (cross-branch links — you'll discover these as you go).

**Run all seeds in PARALLEL.** Each branch agent works independently, unaware of the others.

**Output:** One branch file per seed in `output/trees/`

**Quality gate:** If a branch file contains only information findable in the first 3 Google results for that entity, the branch is too shallow. Go deeper or flag it as needing another pass.

---

## Phase 3: EVALUATE

After ALL Level 1 branches complete, read every branch file and produce:

1. **Cross-branch connections:** Entities or themes that appear in 2+ branches.
2. **Gaps:** Things expected but missing across all branches. These are often the most valuable findings.
3. **Surprises:** Things that appeared unexpectedly.
4. **Branch scores:** Rate each branch's "go deeper" threads by:
   - **Novelty:** Is this findable via simple search? (LOW novelty = skip)
   - **Connectivity:** Does this thread connect to other branches? (HIGH = prioritize)
   - **Gap potential:** Will going deeper likely reveal something missing? (HIGH = prioritize)

Select top `branches_per_level` (default: 3) threads for Level 2.

If `interactive: true` in config, present options to the user and let them choose.
If `interactive: false`, select automatically based on scores.

**Output:** Evaluation summary with selected Level 2 branches and reasons.

---

## Phase 4: DEEPEN (Level 2+)

For each selected thread, run the MAP phase again but deeper:

- Start from the thread, not the original seed
- Focus on specifics: names, numbers, dates, URLs, real quotes
- Find PRIMARY sources, not summaries of summaries
- Map relationships between entities at this depth
- Flag Level N+1 candidates
- Note what you COULDN'T find — what's behind paywalls, what requires access, what needs a human

Repeat MAP → EVALUATE → DEEPEN until `max_depth` reached.

**Output:** Additional branch files in `output/trees/`, named with level prefix (e.g., `L2-media-models.md`)

---

## Phase 5: SYNTHESIZE

After all levels complete, produce three outputs:

### A. Insights (`output/insights.json`)

Extract specific, actionable findings. Each insight must have:

```json
{
  "title": "One-line finding",
  "finding": "2-3 sentences with specifics — names, numbers, sources",
  "sources": ["branch-file-1", "branch-file-2"],
  "type": "cross-branch | single-branch | gap",
  "priority": "TOP | HIGH | MEDIUM | LOW",
  "actionable": true,
  "suggested_action": "What to do with this finding"
}
```

**Categorize automatically** based on what the research contains. Common categories: competitive intel, growth tactics, content ideas, network nodes, gaps, opportunities, data sources. But let the data determine the categories — don't force-fit.

### B. Frontier (`output/frontier.json`)

Every unresolved thread becomes a seed for the next session:

```json
{
  "seed": "Topic to explore",
  "spawned_from": "which branch file generated this",
  "reason": "Why it's worth exploring",
  "expected_depth": "What you'd expect to find"
}
```

This is how research compounds. Session 2 starts from Session 1's frontier, not from scratch.

### C. Session Log (`output/SESSION_LOG.md`)

Document what happened:
- Seeds chosen and why
- Branches explored vs pruned (and why pruned)
- Key decisions made during evaluation
- Time spent per phase (estimate)
- What worked and what didn't

---

## Phase 6: AUDIT

Grade your own work. Be honest — the point is to improve, not to perform.

| Dimension | Score /100 | Rubric |
|-----------|-----------|--------|
| **Depth** | | >70: Found things not in first 3 Google results. <40: Mostly surface-level. |
| **Specificity** | | >70: Names, numbers, dates throughout. <40: Vague claims, no sources. |
| **Gaps found** | | >70: Identified what's MISSING, not just what exists. <40: No gap analysis. |
| **Cross-branch** | | >70: Patterns across 3+ branches. <40: Branches are isolated. |
| **Frontier quality** | | >70: Next-session seeds are genuinely interesting. <40: Generic or obvious. |
| **Honesty** | | >70: Flagged uncertainty, marked unverified claims. <40: Presented guesses as facts. |

**If overall average < 60:** Flag it in the session log. Shallow research that looks deep is worse than admitting the research was shallow.

**Output:** Audit table appended to `output/SESSION_LOG.md`

---

## Key Principles

1. **The data picks the next question, not you.** Don't pre-plan Level 2 before Level 1 finishes.
2. **Gaps are findings.** "Nobody covers X" is often more valuable than "here's who covers X."
3. **Cross-branch patterns are the prize.** They only emerge from parallel, independent branches.
4. **Prune honestly.** Not every branch is worth climbing. Flag why you stopped.
5. **Frontier is the compound interest.** Every session should leave seeds for the next one.
6. **Audit yourself.** If you wouldn't stake your reputation on a finding, flag it as unverified.
