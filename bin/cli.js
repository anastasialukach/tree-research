#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const PROTOCOL_DIR = path.join(__dirname, '..', 'protocol');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(msg) { console.log(msg); }
function green(msg) { return `${COLORS.green}${msg}${COLORS.reset}`; }
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

function init() {
  const isGlobal = args.includes('--global') || args.includes('--claude-code');
  const isCursor = args.includes('--cursor');

  let targetDir;
  let description;

  if (isGlobal) {
    // Install as a Claude Code skill
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    targetDir = path.join(homeDir, '.claude', 'skills', 'tree-research');
    description = 'Claude Code skill (global, all projects)';
  } else if (isCursor) {
    // Install into .cursor/rules/
    targetDir = path.join(process.cwd(), '.cursor', 'rules', 'tree-research');
    description = 'Cursor rules (this project)';
  } else {
    // Install into project
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

  // Create directory structure
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'output', 'trees'), { recursive: true });

  // Copy protocol files
  const protocolFiles = fs.readdirSync(PROTOCOL_DIR);
  for (const file of protocolFiles) {
    fs.copyFileSync(
      path.join(PROTOCOL_DIR, file),
      path.join(targetDir, file)
    );
  }

  // Copy templates
  const templatesDir = path.join(targetDir, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  const templateFiles = fs.readdirSync(TEMPLATES_DIR);
  for (const file of templateFiles) {
    fs.copyFileSync(
      path.join(TEMPLATES_DIR, file),
      path.join(templatesDir, file)
    );
  }

  // Create default config
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

  // Summary
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
  log(`    Or for autonomous mode:`);
  log('');
  log(`    ${green('"Run tree-research on [topic] — 5 seeds, 3 levels deep, autonomous"')}`);
  log('');
  log(`  ${dim('The protocol file tells your agent exactly what to do.')}`);
  log(`  ${dim('It will seed, map, evaluate, deepen, synthesize, and audit.')}`);
  log(`  ${dim('Results land in output/ — trees, insights, frontier, dashboard.')}`);
  log('');
}

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
  log('');
  log(`  ${bold('How it works:')}`);
  log(`    1. Installs a protocol file your AI agent reads automatically`);
  log(`    2. When you say "research X using tree-research", the agent follows the protocol`);
  log(`    3. It seeds, maps, evaluates, deepens, synthesizes, and audits`);
  log(`    4. Output: branch maps, categorized insights, frontier seeds, self-audit`);
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

// Route
switch (command) {
  case 'init':
    init();
    break;
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    help();
}
