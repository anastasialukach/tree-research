#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0];

const PROTOCOL_DIR = path.join(__dirname, '..', 'protocol');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(msg) { console.log(msg); }
function green(msg) { return `${COLORS.green}${msg}${COLORS.reset}`; }
function red(msg) { return `${COLORS.red}${msg}${COLORS.reset}`; }
function yellow(msg) { return `${COLORS.yellow}${msg}${COLORS.reset}`; }
function cyan(msg) { return `${COLORS.cyan}${msg}${COLORS.reset}`; }
function dim(msg) { return `${COLORS.dim}${msg}${COLORS.reset}`; }
function bold(msg) { return `${COLORS.bold}${msg}${COLORS.reset}`; }

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── INIT ────────────────────────────────────────────────────────

function init() {
  const isGlobal = args.includes('--global') || args.includes('--claude-code');
  const isCursor = args.includes('--cursor');

  let targetDir;
  let description;

  if (isGlobal) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    targetDir = path.join(homeDir, '.claude', 'skills', 'tree-research');
    description = 'Claude Code skill (global, all projects)';
  } else if (isCursor) {
    targetDir = path.join(process.cwd(), '.cursor', 'rules', 'tree-research');
    description = 'Cursor rules (this project)';
  } else {
    targetDir = path.join(process.cwd(), '.tree-research');
    description = 'project directory';
  }

  log('');
  log(`  ${green('🌳')} ${bold('tree-research')}`);
  log(`  ${dim('Give AI a tree to climb, not a list to read.')}`);
  log('');

  if (fs.existsSync(targetDir)) {
    log(`  ${yellow('!')} Directory already exists: ${dim(targetDir)}`);
    log(`  ${dim('  Use --force to overwrite')}`);
    if (!args.includes('--force')) {
      log('');
      return;
    }
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'output', 'trees'), { recursive: true });

  const protocolFiles = fs.readdirSync(PROTOCOL_DIR);
  for (const file of protocolFiles) {
    fs.copyFileSync(
      path.join(PROTOCOL_DIR, file),
      path.join(targetDir, file)
    );
  }

  const templatesDir = path.join(targetDir, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  const templateFiles = fs.readdirSync(TEMPLATES_DIR);
  for (const file of templateFiles) {
    fs.copyFileSync(
      path.join(TEMPLATES_DIR, file),
      path.join(templatesDir, file)
    );
  }

  const config = {
    seeds: 5,
    max_depth: 3,
    branches_per_level: 3,
    parallel: true,
    interactive: false,
    audit_on_complete: true,
    frontier_enabled: true,
    output_format: 'markdown',
  };
  fs.writeFileSync(
    path.join(targetDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  log(`  ${green('+')} Installed to ${description}`);
  log(`  ${dim('  ' + targetDir)}`);
  log('');
  log(`  ${green('+')} Created:`);
  log(`    ${cyan('PROTOCOL.md')}        ${dim('— core research protocol (your agent reads this)')}`);
  log(`    ${cyan('TREE_TEMPLATE.md')}   ${dim('— branch file template')}`);
  log(`    ${cyan('SKILL.md')}           ${dim('— skill definition for AI agents')}`);
  log(`    ${cyan('config.json')}        ${dim('— settings (seeds, depth, parallelism)')}`);
  log(`    ${cyan('templates/')}         ${dim('— output templates (dashboard, session log)')}`);
  log(`    ${cyan('output/')}            ${dim('— where research lands')}`);
  log('');
  log(`  ${bold('Usage:')}`);
  log(`    Open your AI agent and say:`);
  log('');
  log(`    ${green('"Research [topic] using the tree-research protocol"')}`);
  log('');
  log(`  ${dim('After your session, run:')}  ${cyan('npx tree-research viz')}`);
  log('');
}

// ─── VIZ ─────────────────────────────────────────────────────────

function findOutputDir() {
  // Check common locations
  const candidates = [
    path.join(process.cwd(), '.tree-research', 'output'),
    path.join(process.cwd(), 'output'),
    path.join(process.cwd(), '.tree-research'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

function parseTreeFiles(treesDir) {
  if (!fs.existsSync(treesDir)) return [];
  const files = fs.readdirSync(treesDir).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(treesDir, f), 'utf8');
    const lines = content.split('\n');
    // Extract title from first heading
    const titleLine = lines.find(l => l.startsWith('# ') || l.startsWith('## '));
    const title = titleLine ? titleLine.replace(/^#+\s*/, '').replace(/\s*[-—].*$/, '').trim() : f.replace('.md', '');
    // Detect level from filename
    let level = 1;
    const lMatch = f.match(/^L(\d)/i);
    if (lMatch) level = parseInt(lMatch[1]);
    // Count sections as a depth proxy
    const sections = lines.filter(l => l.startsWith('## ')).length;
    return { file: f, title, level, sections, lineCount: lines.length };
  });
}

function parseInsights(outputDir) {
  const insightsPath = path.join(outputDir, 'insights.json');
  if (!fs.existsSync(insightsPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
  } catch { return []; }
}

function parseFrontier(outputDir) {
  const frontierPath = path.join(outputDir, 'frontier.json');
  if (!fs.existsSync(frontierPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(frontierPath, 'utf8'));
  } catch { return []; }
}

function parseSessionLog(outputDir) {
  // Check multiple possible locations
  const candidates = [
    path.join(outputDir, 'SESSION_LOG.md'),
    path.join(outputDir, '..', 'SESSION_LOG.md'),
    path.join(process.cwd(), 'SESSION_LOG.md'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      // Try to extract audit scores
      const scores = {};
      const scorePattern = /\|\s*\*?\*?(Depth|Specificity|Gaps|Cross.?branch|Frontier|Honesty)\*?\*?\s*\|\s*(\d+)/gi;
      let match;
      while ((match = scorePattern.exec(content)) !== null) {
        scores[match[1].toLowerCase().replace(/[^a-z]/g, '')] = parseInt(match[2]);
      }
      // Extract topic from first heading or line
      const topicLine = content.split('\n').find(l => l.startsWith('# ') || l.includes('Topic:'));
      const topic = topicLine ? topicLine.replace(/^#+\s*/, '').replace(/^.*Topic:\s*/i, '').trim() : null;
      return { scores, topic, raw: content };
    }
  }
  return { scores: {}, topic: null, raw: '' };
}

function categorizeInsights(insights) {
  const cats = {};
  for (const ins of insights) {
    const cat = ins.category || ins.type || 'uncategorized';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(ins);
  }
  return cats;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CAT_COLORS = {
  guest_opportunity: { color: '#89CFF0', label: 'Guest opportunities' },
  competitive_intel: { color: '#f59e0b', label: 'Competitive intel' },
  mena_signal: { color: '#22c55e', label: 'MENA signals' },
  growth_tactic: { color: '#a78bfa', label: 'Growth tactics' },
  content_idea: { color: '#f472b6', label: 'Content ideas' },
  network_node: { color: '#60a5fa', label: 'Network nodes' },
  collaboration: { color: '#34d399', label: 'Collaborations' },
  data_source: { color: '#c084fc', label: 'Data sources' },
  gap: { color: '#fb923c', label: 'Gaps' },
  'cross-branch': { color: '#38bdf8', label: 'Cross-branch' },
  'single-branch': { color: '#94a3b8', label: 'Single-branch' },
};

function getCatStyle(cat) {
  return CAT_COLORS[cat] || { color: '#94a3b8', label: cat.replace(/_/g, ' ') };
}

function generateDashboard(data) {
  const { trees, insights, frontier, session, topic } = data;

  const totalInsights = insights.length;
  const topInsights = insights.filter(i => i.priority === 'TOP_20' || i.priority === 'TOP');
  const highInsights = insights.filter(i => i.priority === 'HIGH');
  const categories = categorizeInsights(insights);
  const catKeys = Object.keys(categories).sort((a, b) => categories[b].length - categories[a].length);
  const maxLevel = trees.reduce((m, t) => Math.max(m, t.level), 0);
  const displayTopic = topic || session.topic || 'Research Session';

  // Audit scores — use parsed or defaults
  const scores = session.scores || {};
  const dims = [
    { key: 'depth', label: 'Depth', fallback: 0 },
    { key: 'specificity', label: 'Specificity', fallback: 0 },
    { key: 'gaps', label: 'Gaps found', fallback: 0 },
    { key: 'crossbranch', label: 'Cross-branch', fallback: 0 },
    { key: 'frontier', label: 'Frontier', fallback: 0 },
    { key: 'honesty', label: 'Honesty', fallback: 0 },
  ];
  const hasScores = Object.keys(scores).length > 0;

  // Build tree nodes by level
  const treesByLevel = {};
  for (const t of trees) {
    if (!treesByLevel[t.level]) treesByLevel[t.level] = [];
    treesByLevel[t.level].push(t);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>tree-research — ${escapeHtml(displayTopic)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0a0a0c;color:#e8e8ec;line-height:1.55;font-size:14px}
.container{max-width:1100px;margin:0 auto;padding:48px 24px}
h1{font-size:36px;font-weight:800;color:#f5f5f7;margin-bottom:6px;letter-spacing:-0.5px}
.subtitle{color:#77777c;font-size:14px;margin-bottom:40px;font-weight:500}
.subtitle span{color:#22c55e;font-weight:700}
.section-label{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#44444a;margin-bottom:14px}

/* Stats row */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:40px}
.stat-card{background:#141416;border:1px solid #1e1e24;border-radius:10px;padding:16px;text-align:center}
.stat-card .num{font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:800;color:#22c55e}
.stat-card .label{font-size:11px;color:#66666b;margin-top:4px;font-weight:600}

/* Tree viz */
.tree-viz{background:#141416;border:1px solid #1e1e24;border-radius:12px;padding:28px;margin-bottom:40px;overflow-x:auto}
.tree-level{display:flex;gap:10px;margin-bottom:12px;align-items:flex-start}
.tree-level-label{font-family:'JetBrains Mono',monospace;font-size:11px;color:#44444a;width:65px;flex-shrink:0;padding-top:7px;font-weight:600}
.tree-nodes{display:flex;gap:8px;flex-wrap:wrap}
.tree-node{padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;white-space:nowrap}
.tree-node.seed{background:#89CFF015;border:1px solid #89CFF044;color:#89CFF0}
.tree-node.l1{background:#22c55e12;border:1px solid #22c55e33;color:#4ade80}
.tree-node.l2{background:#f59e0b12;border:1px solid #f59e0b33;color:#fbbf24}
.tree-node.l3{background:#a78bfa12;border:1px solid #a78bfa33;color:#c4b5fd}

/* Score bars */
.bars-section{margin-bottom:40px}
.bar-row{display:grid;grid-template-columns:100px 1fr 36px;align-items:center;gap:10px;margin-bottom:6px}
.bar-dim{font-size:12px;color:#66666b;font-weight:600;text-align:right}
.bar-track{height:12px;background:#141416;border:1px solid #1e1e24;border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;background:#22c55e}
.bar-num{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#22c55e;text-align:right}

/* Insight grid */
.insight-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:40px}
.insight-card{background:#141416;border:1px solid #1e1e24;border-radius:8px;padding:14px 16px}
.insight-card .cat{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;font-weight:600}
.insight-card .title{font-size:13px;font-weight:600;color:#e8e8ec;line-height:1.4;margin-bottom:6px}
.priority{font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 8px;border-radius:4px;display:inline-block;font-weight:700}
.priority.top{background:#22c55e18;color:#22c55e;border:1px solid #22c55e33}
.priority.high{background:#89CFF018;color:#89CFF0;border:1px solid #89CFF033}
.priority.medium{background:#f59e0b12;color:#f59e0b;border:1px solid #f59e0b28}
.priority.low{background:#94a3b812;color:#94a3b8;border:1px solid #94a3b828}

/* Category breakdown */
.cat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:40px}
.cat-card{background:#141416;border:1px solid #1e1e24;border-radius:8px;padding:14px;text-align:center}
.cat-card .num{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:800}
.cat-card .label{font-size:11px;color:#66666b;margin-top:3px;font-weight:500}

/* Frontier */
.frontier-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:40px}
.frontier-card{background:#141416;border:1px solid #1e1e24;border-left:3px solid #89CFF0;border-radius:8px;padding:12px 16px}
.frontier-card .seed-title{font-size:13px;font-weight:600;color:#e8e8ec;margin-bottom:3px}
.frontier-card .seed-from{font-size:11px;color:#44444a;font-family:'JetBrains Mono',monospace;font-weight:500}

.footer{text-align:center;padding:32px 0;border-top:1px solid #1a1a1e;color:#44444a;font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:500}
.footer a{color:#89CFF0;text-decoration:none}
.empty{color:#44444a;font-style:italic;padding:20px 0}
</style>
</head>
<body>
<div class="container">

<h1>${escapeHtml(displayTopic)}</h1>
<p class="subtitle"><span>tree-research</span> session output</p>

<p class="section-label">Overview</p>
<div class="stats-row">
  <div class="stat-card"><div class="num">${trees.filter(t => t.level <= 1).length}</div><div class="label">Seeds</div></div>
  <div class="stat-card"><div class="num">${trees.length}</div><div class="label">Branches</div></div>
  <div class="stat-card"><div class="num">${maxLevel || 1}</div><div class="label">Levels deep</div></div>
  <div class="stat-card"><div class="num">${totalInsights}</div><div class="label">Insights</div></div>
  <div class="stat-card"><div class="num">${topInsights.length}</div><div class="label">Top priority</div></div>
  <div class="stat-card"><div class="num">${frontier.length}</div><div class="label">Future seeds</div></div>
</div>

${trees.length > 0 ? `
<p class="section-label">Branch map</p>
<div class="tree-viz">
${Object.keys(treesByLevel).sort().map(level => {
  const lvl = parseInt(level);
  const nodeClass = lvl <= 1 ? (lvl === 0 ? 'seed' : 'l1') : lvl === 2 ? 'l2' : 'l3';
  const label = lvl <= 1 ? 'SEEDS' : 'LEVEL ' + lvl;
  return `<div class="tree-level">
  <div class="tree-level-label">${label}</div>
  <div class="tree-nodes">
    ${treesByLevel[level].map(t => `<div class="tree-node ${nodeClass}">${escapeHtml(t.title)}</div>`).join('\n    ')}
  </div>
</div>`;
}).join('\n')}
</div>` : ''}

${hasScores ? `
<p class="section-label">Audit scores</p>
<div class="bars-section">
${dims.map(d => {
  const val = scores[d.key] || d.fallback;
  return `<div class="bar-row">
  <span class="bar-dim">${d.label}</span>
  <div class="bar-track"><div class="bar-fill" style="width:${val}%"></div></div>
  <span class="bar-num">${val}</span>
</div>`;
}).join('\n')}
</div>` : ''}

${totalInsights > 0 ? `
<p class="section-label">Top insights</p>
<div class="insight-grid">
${insights
  .sort((a, b) => {
    const order = { TOP_20: 0, TOP: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  })
  .slice(0, 15)
  .map(ins => {
    const cat = ins.category || ins.type || 'uncategorized';
    const style = getCatStyle(cat);
    const prio = (ins.priority || 'MEDIUM').replace('_20', '');
    const prioClass = prio.toLowerCase();
    return `<div class="insight-card">
  <div class="cat" style="color:${style.color}">${escapeHtml(style.label)}</div>
  <div class="title">${escapeHtml(ins.title)}</div>
  <span class="priority ${prioClass}">${prio}</span>
</div>`;
  }).join('\n')}
</div>

<p class="section-label">By category (${totalInsights} total)</p>
<div class="cat-row">
${catKeys.map(cat => {
  const style = getCatStyle(cat);
  return `<div class="cat-card" style="border-top:2px solid ${style.color}">
  <div class="num" style="color:${style.color}">${categories[cat].length}</div>
  <div class="label">${escapeHtml(style.label)}</div>
</div>`;
}).join('\n')}
</div>` : '<p class="empty">No insights.json found. Run a research session first.</p>'}

${frontier.length > 0 ? `
<p class="section-label">Frontier — next session starts here</p>
<div class="frontier-grid">
${frontier.slice(0, 12).map(f => `<div class="frontier-card">
  <div class="seed-title">${escapeHtml(f.seed || f.title || f.name || 'Untitled')}</div>
  <div class="seed-from">from: ${escapeHtml(f.spawned_from || f.source || 'session')}</div>
</div>`).join('\n')}
</div>` : ''}

<div class="footer">
  tree-research &nbsp;/&nbsp; <a href="https://github.com/anastasialukach/tree-research">github.com/anastasialukach/tree-research</a>
</div>

</div>
</body>
</html>`;
}

function viz() {
  log('');
  log(`  ${green('🌳')} ${bold('tree-research viz')}`);
  log('');

  const outputDir = findOutputDir();
  if (!outputDir) {
    log(`  ${red('!')} No output directory found.`);
    log(`  ${dim('  Expected .tree-research/output/ in current directory.')}`);
    log(`  ${dim('  Run a research session first, then try again.')}`);
    log('');
    return;
  }

  log(`  ${dim('  Reading from:')} ${outputDir}`);

  const treesDir = path.join(outputDir, 'trees');
  const trees = parseTreeFiles(treesDir);
  const insights = parseInsights(outputDir);
  const frontier = parseFrontier(outputDir);
  const session = parseSessionLog(outputDir);

  // Try to find topic from config or session
  let topic = session.topic;
  if (!topic) {
    const configPath = path.join(outputDir, '..', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        topic = config.topic;
      } catch {}
    }
  }

  const html = generateDashboard({ trees, insights, frontier, session, topic });

  const outPath = path.join(outputDir, 'dashboard.html');
  fs.writeFileSync(outPath, html);

  log('');
  log(`  ${green('+')} Dashboard generated`);
  log(`  ${dim('  ' + outPath)}`);
  log('');
  log(`  ${bold('Stats:')}`);
  log(`    ${cyan(trees.length + '')} branch files`);
  log(`    ${cyan(insights.length + '')} insights`);
  log(`    ${cyan(frontier.length + '')} frontier seeds`);
  log(`    ${cyan(Object.keys(session.scores).length + '')} audit scores`);
  log('');

  // Try to open in browser
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      execSync(`open "${outPath}"`);
      log(`  ${green('→')} Opened in browser`);
    } else if (platform === 'linux') {
      execSync(`xdg-open "${outPath}"`);
      log(`  ${green('→')} Opened in browser`);
    } else if (platform === 'win32') {
      execSync(`start "" "${outPath}"`);
      log(`  ${green('→')} Opened in browser`);
    }
  } catch {
    log(`  ${dim('  Open the file above in your browser to view.')}`);
  }
  log('');
}

// ─── HELP ────────────────────────────────────────────────────────

function help() {
  log('');
  log(`  ${bold('tree-research')} ${dim('— branching research protocol for AI agents')}`);
  log('');
  log(`  ${bold('Commands:')}`);
  log(`    ${cyan('init')}              Install protocol into current project`);
  log(`    ${cyan('init --global')}     Install as Claude Code skill (all projects)`);
  log(`    ${cyan('init --claude-code')} Same as --global`);
  log(`    ${cyan('init --cursor')}     Install into .cursor/rules/`);
  log(`    ${cyan('init --force')}      Overwrite existing installation`);
  log(`    ${cyan('viz')}               Generate visual dashboard from research output`);
  log('');
  log(`  ${bold('How it works:')}`);
  log(`    1. ${cyan('npx tree-research init')}   Install the protocol`);
  log(`    2. Tell your agent: "Research X using tree-research"`);
  log(`    3. ${cyan('npx tree-research viz')}    See your results`);
  log('');
  log(`  ${bold('The protocol:')}`);
  log(`    ${green('SEED')}       Generate 5 diverse entry points (not "top 5" — different angles)`);
  log(`    ${green('MAP')}        For each seed, map its entire world in parallel`);
  log(`    ${green('EVALUATE')}   Read all maps, score branches by surprise + connectivity`);
  log(`    ${green('DEEPEN')}     Pick top 3 threads, go one level deeper`);
  log(`    ${green('SYNTHESIZE')} Cross-branch patterns, gaps, categorized insights`);
  log(`    ${green('AUDIT')}      Grade your own depth, specificity, honesty`);
  log('');
  log(`  ${dim('github.com/anastasialukach/tree-research')}`);
  log('');
}

// ─── ROUTE ───────────────────────────────────────────────────────

switch (command) {
  case 'init':
    init();
    break;
  case 'viz':
  case 'dashboard':
  case 'view':
    viz();
    break;
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    help();
}
