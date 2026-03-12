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

function findOutputDir(explicit) {
  // If user passed a path, use it directly
  if (explicit && fs.existsSync(explicit)) return path.resolve(explicit);
  // Check common locations relative to cwd
  const candidates = [
    path.join(process.cwd(), '.tree-research', 'output'),
    path.join(process.cwd(), 'output'),
    path.join(process.cwd(), '.tree-research'),
    path.join(process.cwd(), 'research'),
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
  // Check multiple locations
  const candidates = [
    path.join(outputDir, 'insights.json'),
    path.join(outputDir, 'insights', 'all-insights.json'),
    path.join(outputDir, 'insights', 'insights.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    }
  }
  return [];
}

function parseFrontier(outputDir) {
  // Check JSON first, then parse from markdown
  const jsonCandidates = [
    path.join(outputDir, 'frontier.json'),
    path.join(outputDir, 'frontier', 'frontier.json'),
  ];
  for (const p of jsonCandidates) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    }
  }
  // Try future-research.md
  const mdPath = path.join(outputDir, 'future-research.md');
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf8');
    const items = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[-—]\s*(.+)/);
      if (match) items.push({ title: match[1], description: match[2].trim() });
    }
    return items;
  }
  return [];
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
  const { trees, insights, frontier, session, topic, outputDir } = data;

  const totalInsights = insights.length;
  const topInsights = insights.filter(i => i.priority === 'TOP_20' || i.priority === 'TOP');
  const categories = categorizeInsights(insights);
  const catKeys = Object.keys(categories).sort((a, b) => categories[b].length - categories[a].length);
  const maxLevel = trees.reduce((m, t) => Math.max(m, t.level), 0) || 1;
  const displayTopic = topic || session.topic || 'Research Session';

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

  // ─── Build mind map data for JS rendering ────────────────────
  const LEVEL_COLORS = ['#89CFF0', '#4ade80', '#fbbf24', '#c4b5fd', '#f472b6'];

  // Organize nodes into mind map structure
  const treesByLevel = {};
  for (const t of trees) {
    const lvl = t.level || 1;
    if (!treesByLevel[lvl]) treesByLevel[lvl] = [];
    treesByLevel[lvl].push(t);
  }
  const levels = Object.keys(treesByLevel).sort((a, b) => a - b).map(Number);
  const frontierSlice = frontier.slice(0, 5);

  // Build mind map nodes for JS
  const mindMapNodes = [];
  const mindMapEdges = [];

  // Root
  mindMapNodes.push({
    id: 'root', label: displayTopic, level: 0, type: 'root',
    tags: ['seed', `L0`], children: levels.length > 0 ? treesByLevel[levels[0]].map((_, i) => `L${levels[0]}-${i}`) : [],
    meta: `${trees.length} branches · ${insights.length} insights`,
    color: '#f5f5f7', expanded: true
  });

  // Level nodes
  for (const lvl of levels) {
    const nodes = treesByLevel[lvl];
    const color = LEVEL_COLORS[Math.min(lvl, LEVEL_COLORS.length - 1)];
    nodes.forEach((t, i) => {
      const nodeId = `L${lvl}-${i}`;
      // Find children at next level
      const nextLvl = levels[levels.indexOf(lvl) + 1];
      const childIds = [];
      if (nextLvl && treesByLevel[nextLvl]) {
        treesByLevel[nextLvl].forEach((_, ci) => {
          if (ci % nodes.length === i) childIds.push(`L${nextLvl}-${ci}`);
        });
      }
      // Frontier children for deepest level
      if (lvl === levels[levels.length - 1] && frontierSlice.length > 0) {
        frontierSlice.forEach((_, fi) => {
          if (fi % nodes.length === i) childIds.push(`F-${fi}`);
        });
      }

      // Extract tags from filename and content
      const tags = [`L${lvl}`];
      if (t.file) tags.push(t.file.replace('.md', ''));
      if (t.sections > 3) tags.push('deep');

      mindMapNodes.push({
        id: nodeId, label: t.title, level: lvl, type: 'branch',
        tags, children: childIds, file: t.file,
        meta: `${t.lineCount} lines · ${t.sections} sections`,
        color, expanded: false
      });

      // Edge to parent
      if (lvl === levels[0]) {
        mindMapEdges.push({ from: 'root', to: nodeId, dashed: false });
      } else {
        const parentLevel = levels[levels.indexOf(lvl) - 1];
        const parentIdx = Math.min(i, treesByLevel[parentLevel].length - 1);
        mindMapEdges.push({ from: `L${parentLevel}-${parentIdx}`, to: nodeId, dashed: false });
      }
    });
  }

  // Frontier stubs
  frontierSlice.forEach((f, i) => {
    const nodeId = `F-${i}`;
    const label = f.seed || f.title || f.name || 'Untitled';
    mindMapNodes.push({
      id: nodeId, label, level: (levels.length > 0 ? Math.max(...levels) + 1 : 2), type: 'frontier',
      tags: ['frontier', 'next-session'], children: [],
      meta: f.description || 'Next session candidate',
      color: '#89CFF0', expanded: false
    });
    const deepestLevel = levels[levels.length - 1];
    if (deepestLevel && treesByLevel[deepestLevel]) {
      const parentIdx = i % treesByLevel[deepestLevel].length;
      mindMapEdges.push({ from: `L${deepestLevel}-${parentIdx}`, to: nodeId, dashed: true });
    }
  });

  // ─── File tree sidebar data ────────────────────────────────────
  const fileTreeItems = [];
  fileTreeItems.push({ name: 'output/', indent: 0, type: 'dir' });
  fileTreeItems.push({ name: 'trees/', indent: 1, type: 'dir' });
  for (const t of trees) {
    fileTreeItems.push({ name: t.file, indent: 2, type: 'file', lines: t.lineCount, level: t.level });
  }
  if (insights.length > 0) fileTreeItems.push({ name: 'insights.json', indent: 1, type: 'file', extra: `${insights.length} entries` });
  if (frontier.length > 0) fileTreeItems.push({ name: 'frontier.json', indent: 1, type: 'file', extra: `${frontier.length} seeds` });
  fileTreeItems.push({ name: 'SESSION_LOG.md', indent: 1, type: 'file' });

  // ─── Prepare data for JS ──────────────────────────────────────
  const insightsSorted = [...insights].sort((a, b) => {
    const order = { TOP_20: 0, TOP: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  const insightsJson = JSON.stringify(insightsSorted.map(ins => ({
    title: ins.title,
    description: ins.description || ins.detail || ins.text || '',
    category: ins.category || ins.type || 'uncategorized',
    priority: (ins.priority || 'MEDIUM').replace('_20', ''),
    source: ins.source || '',
    branch: ins.branch || ins.source || '',
  })));

  const frontierJson = JSON.stringify(frontier.map(f => ({
    title: f.seed || f.title || f.name || 'Untitled',
    description: f.description || f.detail || '',
    source: f.spawned_from || f.source || 'session',
  })));

  const mindMapJson = JSON.stringify({ nodes: mindMapNodes, edges: mindMapEdges });
  const levelColorsJson = JSON.stringify(LEVEL_COLORS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>tree-research — ${escapeHtml(displayTopic)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0a0a0c;color:#e8e8ec;line-height:1.55;font-size:14px;-webkit-font-smoothing:antialiased}
.container{max-width:1200px;margin:0 auto;padding:48px 24px}

/* Header */
.header{margin-bottom:40px}
.header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
h1{font-size:32px;font-weight:800;color:#f5f5f7;letter-spacing:-0.5px}
.subtitle{color:#55555a;font-size:13px;font-weight:500}
.subtitle span{color:#22c55e;font-weight:700}

/* Search bar */
.search-bar{position:relative;margin-bottom:32px}
.search-bar input{width:100%;background:#111113;border:1px solid #1e1e24;border-radius:10px;padding:12px 16px 12px 42px;font-family:'Inter',sans-serif;font-size:14px;color:#e8e8ec;outline:none;transition:border-color 0.2s}
.search-bar input:focus{border-color:#22c55e44}
.search-bar input::placeholder{color:#44444a}
.search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#44444a}
.search-count{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-family:'JetBrains Mono',monospace;font-size:11px;color:#44444a;font-weight:500}

/* Section labels */
.section-label{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#44444a;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.section-label .count{color:#55555a;font-weight:500;font-size:10px}

/* Stats strip */
.stats-row{display:flex;gap:1px;margin-bottom:32px;background:#1e1e24;border-radius:12px;overflow:hidden}
.stat-card{flex:1;background:#111113;padding:18px 12px;text-align:center}
.stat-card:first-child{border-radius:12px 0 0 12px}
.stat-card:last-child{border-radius:0 12px 12px 0}
.stat-card .num{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:800;color:#22c55e}
.stat-card .label{font-size:11px;color:#55555a;margin-top:2px;font-weight:600;letter-spacing:0.3px}

/* Mind map container */
.mindmap-container{background:#111113;border:1px solid #1e1e24;border-radius:14px;margin-bottom:32px;position:relative;overflow-x:auto;overflow-y:hidden}
.mindmap-canvas{position:relative;min-height:300px;padding:32px 24px}
.mindmap-svg{position:absolute;top:0;left:0;pointer-events:none;z-index:0}

/* Mind map cards */
.mm-node{position:absolute;background:#141416;border:1px solid #1e1e24;border-radius:10px;padding:12px 16px;min-width:180px;max-width:240px;cursor:pointer;transition:all 0.25s ease;z-index:1;user-select:none}
.mm-node:hover{border-color:#2a2a30;transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.3)}
.mm-node.collapsed .mm-children-indicator{display:flex}
.mm-node.root{border-style:dashed;border-color:#33333a;max-width:280px;text-align:center}
.mm-node.frontier{border-style:dashed;border-color:#89CFF033;opacity:0.7}
.mm-node.frontier:hover{opacity:1}
.mm-node.hidden{display:none}
.mm-node.highlight{border-color:#22c55e66;box-shadow:0 0 16px rgba(34,197,94,0.15)}

.mm-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:8px;flex-shrink:0;margin-top:2px}
.mm-header{display:flex;align-items:flex-start}
.mm-title{font-size:13px;font-weight:600;color:#e0e0e5;line-height:1.35}
.mm-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#44444a;margin-top:4px}
.mm-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.mm-tag{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;padding:2px 7px;border-radius:4px;background:#1a1a1e;border:1px solid #1e1e24;color:#66666b;letter-spacing:0.3px}
.mm-tag.level{border-color:#22c55e28;color:#22c55e88}
.mm-tag.file{border-color:#89CFF028;color:#89CFF088}
.mm-tag.frontier-tag{border-color:#c4b5fd28;color:#c4b5fd88}

.mm-expand{position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;background:#1a1a1e;border:1px solid #2a2a30;display:flex;align-items:center;justify-content:center;font-size:10px;color:#55555a;cursor:pointer;transition:all 0.15s;z-index:2}
.mm-expand:hover{background:#222228;color:#e0e0e5;border-color:#44444a}

/* Level legend */
.mm-legend{display:flex;gap:16px;padding:12px 28px 16px;border-top:1px solid #1a1a1e;flex-wrap:wrap;align-items:center}
.legend-item{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#55555a}
.legend-dot{width:8px;height:8px;border-radius:2px}
.mm-controls{margin-left:auto;display:flex;gap:8px}
.mm-btn{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;padding:4px 10px;border-radius:5px;background:#1a1a1e;border:1px solid #1e1e24;color:#55555a;cursor:pointer;transition:all 0.15s}
.mm-btn:hover{border-color:#33333a;color:#b0b0b5}

/* Main grid */
.main-grid{display:grid;grid-template-columns:300px 1fr;gap:20px;margin-bottom:32px}
@media(max-width:800px){.main-grid{grid-template-columns:1fr}}

/* File tree */
.file-tree{background:#111113;border:1px solid #1e1e24;border-radius:14px;padding:20px}
.panel-title{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#44444a;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
.panel-title .badge{font-size:10px;background:#22c55e15;color:#22c55e;padding:2px 8px;border-radius:4px;font-weight:700}
.ft-row{display:flex;align-items:center;gap:6px;padding:4px 0;font-family:'JetBrains Mono',monospace;font-size:11.5px}
.ft-icon{width:14px;text-align:center;flex-shrink:0}
.ft-icon.dir{color:#f59e0b}
.ft-icon.file{color:#55555a}
.ft-name{color:#a0a0a5;font-weight:500}
.ft-name.dir{color:#f59e0b;font-weight:600}
.ft-meta{color:#33333a;font-size:10px;margin-left:auto;white-space:nowrap}
.ft-new{color:#22c55e;font-size:8px;font-weight:700;background:#22c55e12;padding:1px 5px;border-radius:3px;margin-left:6px;letter-spacing:0.5px}

/* Insights panel (collapsible categories) */
.insights-panel{background:#111113;border:1px solid #1e1e24;border-radius:14px;padding:20px}

.cat-group{margin-bottom:4px}
.cat-header{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background 0.15s;user-select:none}
.cat-header:hover{background:#1a1a1e}
.cat-header .chevron{color:#44444a;font-size:10px;transition:transform 0.2s;width:14px;flex-shrink:0}
.cat-header.open .chevron{transform:rotate(90deg)}
.cat-header .cat-name{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.8px;text-transform:uppercase;font-weight:600}
.cat-header .cat-count{font-family:'JetBrains Mono',monospace;font-size:10px;color:#44444a;font-weight:500;margin-left:auto}
.cat-header .cat-bar{flex:1;max-width:80px;height:4px;background:#1e1e24;border-radius:2px;overflow:hidden;margin-left:8px}
.cat-header .cat-bar-fill{height:100%;border-radius:2px}

.cat-items{overflow:hidden;max-height:0;transition:max-height 0.3s ease-out}
.cat-items.open{max-height:2000px;transition:max-height 0.5s ease-in}

.insight-row{padding:10px 12px 10px 36px;border-bottom:1px solid #141416;cursor:pointer;transition:background 0.12s}
.insight-row:hover{background:#141416}
.insight-row:last-child{border-bottom:none}
.insight-row .i-title{font-size:13px;font-weight:600;color:#d0d0d5;line-height:1.4}
.insight-row .i-detail{font-size:12px;color:#66666b;line-height:1.5;margin-top:4px;max-height:0;overflow:hidden;transition:max-height 0.25s ease-out}
.insight-row.expanded .i-detail{max-height:200px;transition:max-height 0.4s ease-in}
.insight-row .i-meta{display:flex;align-items:center;gap:8px;margin-top:4px}
.insight-row .i-source{font-family:'JetBrains Mono',monospace;font-size:10px;color:#44444a}

/* Priority badges */
.priority{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 7px;border-radius:4px;display:inline-block;font-weight:700;letter-spacing:0.3px}
.priority.top{background:#22c55e15;color:#22c55e;border:1px solid #22c55e28}
.priority.high{background:#89CFF015;color:#89CFF0;border:1px solid #89CFF028}
.priority.medium{background:#f59e0b10;color:#f59e0b;border:1px solid #f59e0b20}
.priority.low{background:#94a3b810;color:#94a3b8;border:1px solid #94a3b820}

/* Audit scores */
.bars-section{margin-bottom:32px;background:#111113;border:1px solid #1e1e24;border-radius:14px;padding:20px}
.bar-row{display:grid;grid-template-columns:90px 1fr 36px;align-items:center;gap:10px;margin-bottom:8px}
.bar-dim{font-size:11px;color:#66666b;font-weight:600;text-align:right}
.bar-track{height:6px;background:#0d0d0f;border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;background:#22c55e;transition:width 0.8s ease-out}
.bar-num{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#22c55e;text-align:right}

/* Category summary row */
.cat-summary{display:flex;gap:8px;margin-bottom:32px;flex-wrap:wrap}
.cat-pill{display:flex;align-items:center;gap:6px;background:#111113;border:1px solid #1e1e24;border-radius:8px;padding:8px 14px;cursor:pointer;transition:all 0.15s;user-select:none}
.cat-pill:hover{border-color:#2a2a30;background:#141416}
.cat-pill.active{border-color:#2a2a30}
.cat-pill .cp-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.cat-pill .cp-count{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;color:#e8e8ec}
.cat-pill .cp-label{font-size:11px;color:#55555a;font-weight:500}

/* Frontier */
.frontier-section{margin-bottom:32px}
.frontier-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.frontier-card{background:#111113;border:1px solid #1e1e24;border-radius:10px;padding:14px 16px;transition:border-color 0.15s;position:relative;overflow:hidden}
.frontier-card:hover{border-color:#89CFF033}
.frontier-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#89CFF044;border-radius:3px 0 0 3px}
.frontier-card .seed-title{font-size:13px;font-weight:600;color:#c0c0c5;margin-bottom:3px;padding-left:8px}
.frontier-card .seed-desc{font-size:11.5px;color:#55555a;line-height:1.45;padding-left:8px}

/* Footer */
.footer{text-align:center;padding:28px 0;border-top:1px solid #141416;color:#33333a;font-size:11px;font-family:'JetBrains Mono',monospace;font-weight:500}
.footer a{color:#55555a;text-decoration:none;transition:color 0.15s}
.footer a:hover{color:#89CFF0}

/* Empty state */
.empty{color:#44444a;font-style:italic;padding:20px 0}

/* Highlight matching text */
mark{background:#22c55e22;color:#22c55e;border-radius:2px;padding:0 1px}

/* Smooth scroll */
html{scroll-behavior:smooth}
</style>
</head>
<body>
<div class="container">

<div class="header">
  <div class="header-top">
    <div>
      <h1>${escapeHtml(displayTopic)}</h1>
      <p class="subtitle"><span>tree-research</span> session output</p>
    </div>
  </div>
</div>

<!-- Search -->
<div class="search-bar">
  <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  <input type="text" id="search" placeholder="Search insights, branches, frontier..." autocomplete="off" spellcheck="false"/>
  <span class="search-count" id="searchCount"></span>
</div>

<!-- Stats -->
<div class="stats-row">
  <div class="stat-card"><div class="num">${trees.filter(t => t.level <= 1).length}</div><div class="label">Seeds</div></div>
  <div class="stat-card"><div class="num">${trees.length}</div><div class="label">Branches</div></div>
  <div class="stat-card"><div class="num">${maxLevel}</div><div class="label">Levels deep</div></div>
  <div class="stat-card"><div class="num">${totalInsights}</div><div class="label">Insights</div></div>
  <div class="stat-card"><div class="num">${topInsights.length}</div><div class="label">Top priority</div></div>
  <div class="stat-card"><div class="num">${frontier.length}</div><div class="label">Future seeds</div></div>
</div>

${trees.length > 0 ? `
<p class="section-label">Mind map <span class="count">click nodes to expand</span></p>
<div class="mindmap-container">
  <div class="mindmap-canvas" id="mindmapCanvas">
    <svg class="mindmap-svg" id="mindmapSvg" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <div class="mm-legend">
    <div class="legend-item"><div class="legend-dot" style="background:#89CFF0"></div>Seeds</div>
    <div class="legend-item"><div class="legend-dot" style="background:#4ade80"></div>Level 1</div>
    ${maxLevel >= 2 ? '<div class="legend-item"><div class="legend-dot" style="background:#fbbf24"></div>Level 2</div>' : ''}
    ${maxLevel >= 3 ? '<div class="legend-item"><div class="legend-dot" style="background:#c4b5fd"></div>Level 3</div>' : ''}
    ${frontierSlice.length > 0 ? '<div class="legend-item"><div class="legend-dot" style="background:#89CFF066;border:1px dashed #89CFF044"></div>Frontier</div>' : ''}
    <div class="mm-controls">
      <button class="mm-btn" onclick="expandAll()">Expand all</button>
      <button class="mm-btn" onclick="collapseAll()">Collapse</button>
    </div>
  </div>
</div>` : ''}

<!-- Main grid: file tree + insights by category -->
<div class="main-grid">
  <div class="file-tree">
    <div class="panel-title">Files created <span class="badge">${trees.length + (insights.length > 0 ? 1 : 0) + (frontier.length > 0 ? 1 : 0) + 1} files</span></div>
    ${fileTreeItems.map(item => {
      const indent = item.indent * 16;
      if (item.type === 'dir') {
        return `<div class="ft-row" style="padding-left:${indent}px"><span class="ft-icon dir">▸</span><span class="ft-name dir">${item.name}</span></div>`;
      }
      const meta = item.lines ? `${item.lines}L` : (item.extra || '');
      const levelColors = { 1: '#4ade80', 2: '#fbbf24', 3: '#c4b5fd' };
      const dotColor = item.level ? (levelColors[item.level] || '#55555a') : '#55555a';
      return `<div class="ft-row" style="padding-left:${indent}px"><span class="ft-icon file" style="color:${dotColor}">◆</span><span class="ft-name">${item.name}</span><span class="ft-new">NEW</span>${meta ? `<span class="ft-meta">${meta}</span>` : ''}</div>`;
    }).join('\n    ')}
  </div>

  <div class="insights-panel" id="insightsPanel">
    <div class="panel-title">Insights by category <span class="badge">${totalInsights} total</span></div>
    <div id="catGroups"></div>
    ${totalInsights === 0 ? '<p class="empty">No insights yet.</p>' : ''}
  </div>
</div>

${hasScores ? `
<p class="section-label">Audit scores</p>
<div class="bars-section">
${dims.map(d => {
  const val = scores[d.key] || d.fallback;
  const color = val >= 70 ? '#22c55e' : val >= 40 ? '#f59e0b' : '#ef4444';
  return `<div class="bar-row">
  <span class="bar-dim">${d.label}</span>
  <div class="bar-track"><div class="bar-fill" style="width:${val}%;background:${color}" data-width="${val}"></div></div>
  <span class="bar-num" style="color:${color}">${val}</span>
</div>`;
}).join('\n')}
</div>` : ''}

<!-- Category summary pills -->
${totalInsights > 0 ? `
<p class="section-label">By category <span class="count">${catKeys.length} categories</span></p>
<div class="cat-summary" id="catSummary">
${catKeys.map(cat => {
  const style = getCatStyle(cat);
  const pct = Math.round((categories[cat].length / totalInsights) * 100);
  return `<div class="cat-pill" data-cat="${cat}" onclick="filterByCat('${cat}')">
  <div class="cp-dot" style="background:${style.color}"></div>
  <span class="cp-count">${categories[cat].length}</span>
  <span class="cp-label">${escapeHtml(style.label)}</span>
</div>`;
}).join('\n')}
</div>` : ''}

${frontier.length > 0 ? `
<p class="section-label">Frontier — next session seeds <span class="count">${frontier.length} candidates</span></p>
<div class="frontier-grid" id="frontierGrid">
${frontier.slice(0, 15).map((f, i) => `<div class="frontier-card" data-idx="${i}">
  <div class="seed-title">${escapeHtml(f.seed || f.title || f.name || 'Untitled')}</div>
  ${f.description ? `<div class="seed-desc">${escapeHtml(f.description).slice(0, 100)}</div>` : ''}
</div>`).join('\n')}
</div>` : ''}

<div class="footer">
  tree-research &nbsp;·&nbsp; <a href="https://github.com/anastasialukach/tree-research">github</a>
</div>

</div>

<script>
// ─── Data ─────────────────────────────────────────────────────
const insights = ${insightsJson};
const frontier = ${frontierJson};
const CAT_COLORS = ${JSON.stringify(CAT_COLORS)};

function getCatStyle(cat) {
  return CAT_COLORS[cat] || { color: '#94a3b8', label: cat.replace(/_/g, ' ') };
}

// ─── Build collapsible insight categories ─────────────────────
function buildInsightCategories(filter) {
  const cats = {};
  const q = (filter || '').toLowerCase();
  for (const ins of insights) {
    if (q && !ins.title.toLowerCase().includes(q) && !ins.description.toLowerCase().includes(q) && !ins.category.toLowerCase().includes(q)) continue;
    const cat = ins.category;
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(ins);
  }

  const container = document.getElementById('catGroups');
  const sortedCats = Object.keys(cats).sort((a, b) => cats[b].length - cats[a].length);
  const maxCount = Math.max(...sortedCats.map(c => cats[c].length), 1);

  container.innerHTML = sortedCats.map((cat, ci) => {
    const style = getCatStyle(cat);
    const items = cats[cat];
    const barPct = Math.round((items.length / maxCount) * 100);
    const isOpen = ci === 0 || !!filter; // first category open by default, all open when searching

    return '<div class="cat-group">' +
      '<div class="cat-header' + (isOpen ? ' open' : '') + '" onclick="toggleCat(this)">' +
        '<span class="chevron">▸</span>' +
        '<span class="cat-name" style="color:' + style.color + '">' + (style.label || cat) + '</span>' +
        '<div class="cat-bar"><div class="cat-bar-fill" style="width:' + barPct + '%;background:' + style.color + '"></div></div>' +
        '<span class="cat-count">' + items.length + '</span>' +
      '</div>' +
      '<div class="cat-items' + (isOpen ? ' open' : '') + '">' +
        items.map(ins => {
          const prio = ins.priority;
          const prioClass = prio.toLowerCase();
          const title = q ? highlightText(ins.title, q) : esc(ins.title);
          const desc = ins.description ? (q ? highlightText(ins.description, q) : esc(ins.description)) : '';
          return '<div class="insight-row" onclick="toggleInsight(this)">' +
            '<div class="i-title">' + title + '</div>' +
            (desc ? '<div class="i-detail"><p>' + desc + '</p></div>' : '') +
            '<div class="i-meta">' +
              '<span class="priority ' + prioClass + '">' + prio + '</span>' +
              (ins.source ? '<span class="i-source">' + esc(ins.source) + '</span>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');

  // Update search count
  const total = Object.values(cats).reduce((s, a) => s + a.length, 0);
  document.getElementById('searchCount').textContent = filter ? total + ' / ' + insights.length : '';
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function highlightText(text, q) {
  const escaped = esc(text);
  const re = new RegExp('(' + q.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

function toggleCat(el) {
  el.classList.toggle('open');
  const items = el.nextElementSibling;
  items.classList.toggle('open');
}

function toggleInsight(el) {
  el.classList.toggle('expanded');
}

function filterByCat(cat) {
  const searchInput = document.getElementById('search');
  searchInput.value = cat.replace(/_/g, ' ');
  buildInsightCategories(cat.replace(/_/g, ' '));
}

// ─── Search ───────────────────────────────────────────────────
let searchTimeout;
document.getElementById('search').addEventListener('input', function() {
  clearTimeout(searchTimeout);
  const q = this.value;
  searchTimeout = setTimeout(() => {
    buildInsightCategories(q);
    // Also filter frontier
    filterFrontier(q);
    // Highlight tree nodes
    highlightTreeNodes(q);
  }, 150);
});

function filterFrontier(q) {
  const cards = document.querySelectorAll('.frontier-card');
  const ql = (q || '').toLowerCase();
  cards.forEach((card, i) => {
    if (!ql || (frontier[i] && (frontier[i].title.toLowerCase().includes(ql) || frontier[i].description.toLowerCase().includes(ql)))) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

function highlightTreeNodes(q) {
  const ql = (q || '').toLowerCase();
  for (const node of mindMap.nodes) {
    const el = nodeElements[node.id];
    if (!el) continue;
    if (ql && (node.label.toLowerCase().includes(ql) || (node.tags || []).some(t => t.toLowerCase().includes(ql)))) {
      el.classList.add('highlight');
    } else {
      el.classList.remove('highlight');
    }
  }
}

// ─── Interactive Mind Map ──────────────────────────────────────
const mindMap = ${mindMapJson};
const LEVEL_COLORS = ${levelColorsJson};
const mmCanvas = document.getElementById('mindmapCanvas');
const mmSvg = document.getElementById('mindmapSvg');

// Node positions (computed by layout — LEFT TO RIGHT)
const nodePositions = {};
const nodeElements = {};
const NODE_W = 210, NODE_H_BASE = 70, COL_GAP = 40, ROW_GAP = 16;

function getNodeById(id) { return mindMap.nodes.find(n => n.id === id); }

function isNodeVisible(node) {
  if (node.id === 'root') return true;
  // Walk up parent chain — all ancestors must be expanded
  const parentEdge = mindMap.edges.find(e => e.to === node.id);
  if (!parentEdge) return true;
  const parent = getNodeById(parentEdge.from);
  if (!parent) return true;
  return parent.expanded && isNodeVisible(parent);
}

function getVisibleChildren(nodeId) {
  const node = getNodeById(nodeId);
  if (!node || !node.expanded) return [];
  return mindMap.edges.filter(e => e.from === nodeId).map(e => getNodeById(e.to)).filter(Boolean);
}

function computeLayout() {
  // LEFT-TO-RIGHT: each level is a column, nodes stack vertically
  const byLevel = {};
  for (const node of mindMap.nodes) {
    if (!isNodeVisible(node)) continue;
    const lvl = node.level;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(node);
  }

  const sortedLevels = Object.keys(byLevel).sort((a, b) => a - b).map(Number);

  // Measure each node's expected height
  function nodeH(node) {
    let h = 52; // base: title + meta
    if (node.tags && node.tags.length > 0) h += 28; // tags row
    if (node.type === 'frontier' && node.meta) h += 20; // description
    return h;
  }

  // Compute column x positions and vertical centering
  let x = 24;
  let canvasH = 0;

  for (const lvl of sortedLevels) {
    const nodes = byLevel[lvl];
    const colW = lvl === 0 ? 230 : (nodes[0] && nodes[0].type === 'frontier' ? 210 : NODE_W);
    const totalH = nodes.reduce((s, n) => s + nodeH(n) + ROW_GAP, -ROW_GAP);
    canvasH = Math.max(canvasH, totalH);

    let y = 20;
    nodes.forEach((node) => {
      const h = nodeH(node);
      nodePositions[node.id] = { x, y, w: colW, h };
      y += h + ROW_GAP;
    });
    x += colW + COL_GAP;
  }

  // Vertically center each column
  for (const lvl of sortedLevels) {
    const nodes = byLevel[lvl];
    if (nodes.length === 0) continue;
    const firstPos = nodePositions[nodes[0].id];
    const lastPos = nodePositions[nodes[nodes.length - 1].id];
    const colH = (lastPos.y + lastPos.h) - firstPos.y;
    const offset = Math.max(0, (canvasH - colH) / 2);
    for (const node of nodes) {
      nodePositions[node.id].y += offset;
    }
  }

  return { w: x + 20, h: canvasH + 60 };
}

function renderNodes() {
  // Remove old node elements
  Object.values(nodeElements).forEach(el => el.remove());
  Object.keys(nodeElements).forEach(k => delete nodeElements[k]);

  for (const node of mindMap.nodes) {
    if (!isNodeVisible(node)) continue;
    const pos = nodePositions[node.id];
    if (!pos) continue;

    const el = document.createElement('div');
    const typeClass = node.type === 'root' ? ' root' : node.type === 'frontier' ? ' frontier' : '';
    const expandedClass = node.expanded ? '' : ' collapsed';
    el.className = 'mm-node' + typeClass + expandedClass;
    const nodeW = pos.w || NODE_W;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.width = nodeW + 'px';
    el.dataset.id = node.id;

    const color = node.type === 'root' ? '#f5f5f7' : (LEVEL_COLORS[Math.min(node.level, LEVEL_COLORS.length - 1)] || '#94a3b8');
    const dotColor = node.type === 'frontier' ? '#89CFF066' : color;

    let html = '<div class="mm-header">';
    html += '<span class="mm-dot" style="background:' + dotColor + '"></span>';
    html += '<span class="mm-title">' + esc(node.label) + '</span>';
    html += '</div>';
    html += '<div class="mm-meta">' + esc(node.meta || '') + '</div>';

    // Tags
    if (node.tags && node.tags.length > 0) {
      html += '<div class="mm-tags">';
      for (const tag of node.tags) {
        const tagClass = tag.startsWith('L') ? 'level' : tag === 'frontier' || tag === 'next-session' ? 'frontier-tag' : tag.endsWith('.md') || tag.includes('-') ? 'file' : '';
        html += '<span class="mm-tag ' + tagClass + '">#' + esc(tag) + '</span>';
      }
      html += '</div>';
    }

    // Expand button if has children
    if (node.children && node.children.length > 0) {
      const symbol = node.expanded ? '−' : '+';
      html += '<div class="mm-expand" onclick="event.stopPropagation();toggleNode(\\''+node.id+'\\')">' + symbol + '</div>';
    }

    el.innerHTML = html;
    el.addEventListener('click', () => toggleNode(node.id));
    mmCanvas.appendChild(el);
    nodeElements[node.id] = el;
  }
}

function renderEdges() {
  mmSvg.innerHTML = '';
  const canvasRect = mmCanvas.getBoundingClientRect();

  for (const edge of mindMap.edges) {
    const fromNode = getNodeById(edge.from);
    const toNode = getNodeById(edge.to);
    if (!fromNode || !toNode) continue;
    if (!isNodeVisible(fromNode) || !isNodeVisible(toNode)) continue;

    const fromPos = nodePositions[edge.from];
    const toPos = nodePositions[edge.to];
    if (!fromPos || !toPos) continue;

    const fromEl = nodeElements[edge.from];
    const toEl = nodeElements[edge.to];
    if (!fromEl || !toEl) continue;

    const fromW = fromPos.w || NODE_W;
    const fromH = fromEl.offsetHeight;
    const toH = toEl.offsetHeight;
    // Horizontal: exit from right side of parent, enter left side of child
    const x1 = fromPos.x + fromW;
    const y1 = fromPos.y + fromH / 2;
    const x2 = toPos.x;
    const y2 = toPos.y + toH / 2;

    const color = toNode.type === 'frontier' ? '#89CFF033' :
      (LEVEL_COLORS[Math.min(toNode.level, LEVEL_COLORS.length - 1)] || '#333') + '44';

    const midX = (x1 + x2) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + midX + ',' + y1 + ' ' + midX + ',' + y2 + ' ' + x2 + ',' + y2);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    if (edge.dashed) path.setAttribute('stroke-dasharray', '6,4');
    mmSvg.appendChild(path);
  }
}

function layoutAndRender() {
  const dims = computeLayout();
  mmCanvas.style.minWidth = dims.w + 'px';
  mmCanvas.style.minHeight = dims.h + 'px';
  mmSvg.style.width = dims.w + 'px';
  mmSvg.style.height = dims.h + 'px';
  renderNodes();
  // Edges need node heights, so render after a frame
  requestAnimationFrame(() => renderEdges());
}

function toggleNode(id) {
  const node = getNodeById(id);
  if (!node || !node.children || node.children.length === 0) return;
  node.expanded = !node.expanded;
  layoutAndRender();
}

function expandAll() {
  for (const node of mindMap.nodes) {
    if (node.children && node.children.length > 0) node.expanded = true;
  }
  layoutAndRender();
}

function collapseAll() {
  for (const node of mindMap.nodes) {
    if (node.id !== 'root') node.expanded = false;
  }
  layoutAndRender();
}

// Init mind map
if (mmCanvas) {
  layoutAndRender();
  // Start scrolled to the left (root visible)
  requestAnimationFrame(() => {
    const container = mmCanvas.parentElement;
    if (container) container.scrollLeft = 0;
  });
}

// ─── Animate bars on scroll ───────────────────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const fill = e.target.querySelector('.bar-fill');
      if (fill) {
        const w = fill.dataset.width;
        fill.style.width = '0%';
        requestAnimationFrame(() => { fill.style.width = w + '%'; });
      }
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.bar-row').forEach(r => observer.observe(r));

// ─── Init ─────────────────────────────────────────────────────
buildInsightCategories('');
</script>
</body>
</html>`;
}

function viz() {
  log('');
  log(`  ${green('🌳')} ${bold('tree-research viz')}`);
  log('');

  const outputDir = findOutputDir(args[1]);
  if (!outputDir) {
    log(`  ${red('!')} No output directory found.`);
    log(`  ${dim('  Expected .tree-research/output/ in current directory,')}`);
    log(`  ${dim('  or pass a path: tree-research viz ./path/to/output')}`);
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
