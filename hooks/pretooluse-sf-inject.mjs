import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');

// --- Salesforce detection patterns ---

const SF_FILE_PATTERNS = [
  /force-app\//,
  /\.cls$/,
  /\.trigger$/,
  /\.page$/,
  /\.component$/,
  /\.cmp$/,
  /\.apex$/,
  /\.soql$/,
  /sfdx-project\.json$/,
  /sf-project\.json$/,
];

const SF_BASH_PATTERNS = [
  /\bsf\s+/,
  /\bsfdx\s+/,
  /\bsf\s+org\b/,
  /\bsf\s+deploy\b/,
  /\bsf\s+retrieve\b/,
  /\bsf\s+apex\b/,
];

// --- Session dedup ---

function hashId(id) {
  return createHash('sha256').update(id).digest('hex').slice(0, 16);
}

function getDedupPath(sessionId) {
  return join(tmpdir(), `sf-docs-plugin-${hashId(sessionId)}-seen.txt`);
}

function getSeenSkills(sessionId) {
  if (!sessionId) return new Set();
  const path = getDedupPath(sessionId);
  if (!existsSync(path)) return new Set();
  const raw = readFileSync(path, 'utf-8').trim();
  return new Set(raw ? raw.split(',') : []);
}

function markSeen(sessionId, skillName) {
  if (!sessionId) return;
  const seen = getSeenSkills(sessionId);
  seen.add(skillName);
  writeFileSync(getDedupPath(sessionId), [...seen].join(','), 'utf-8');
}

// --- Skill loading ---

function loadSkillContent(skillPath) {
  if (!existsSync(skillPath)) return null;
  return readFileSync(skillPath, 'utf-8');
}

function findGeneratedSme(pluginRoot) {
  const generatedDir = join(pluginRoot, 'data', 'generated');
  if (!existsSync(generatedDir)) return [];
  return readdirSync(generatedDir).filter(name => {
    const skillPath = join(generatedDir, name, 'SKILL.md');
    return existsSync(skillPath);
  });
}

// --- Detection ---

function detectSalesforce(toolName, toolInput) {
  const target = toolName === 'Bash'
    ? (toolInput.command || '')
    : (toolInput.file_path || '');

  if (!target) return false;

  const patterns = toolName === 'Bash' ? SF_BASH_PATTERNS : SF_FILE_PATTERNS;
  return patterns.some(p => p.test(target));
}

// --- Main ---

try {
  const raw = readFileSync(0, 'utf-8');
  const input = JSON.parse(raw);
  const { tool_name, tool_input, session_id } = input;

  if (!detectSalesforce(tool_name, tool_input)) {
    process.stdout.write('{}');
    process.exit(0);
  }

  const seen = getSeenSkills(session_id);

  // Check for generated SME skills first
  const smeNames = findGeneratedSme(PLUGIN_ROOT);
  let skillName = 'sf-docs';
  let skillPath = join(PLUGIN_ROOT, 'skills', 'sf-docs', 'SKILL.md');

  // If there are generated SMEs and we haven't injected any yet, pick the first one
  for (const smeName of smeNames) {
    const smeSkillName = `sf-${smeName}`;
    if (!seen.has(smeSkillName)) {
      skillName = smeSkillName;
      skillPath = join(PLUGIN_ROOT, 'data', 'generated', smeName, 'SKILL.md');
      break;
    }
  }

  // Fall back to base skill if all SMEs already seen
  if (skillName !== 'sf-docs' || !seen.has('sf-docs')) {
    // Check dedup
    if (seen.has(skillName)) {
      process.stdout.write('{}');
      process.exit(0);
    }

    const content = loadSkillContent(skillPath);
    if (!content) {
      process.stdout.write('{}');
      process.exit(0);
    }

    markSeen(session_id, skillName);

    const pluginRootNote = `\n\n**SF-Docs Plugin Root:** \`${PLUGIN_ROOT}\`\n\nUse this path as $PLUGIN_ROOT when running sf-docs CLI commands.\n`;

    const context = `[sf-docs-plugin] Salesforce project detected. Injecting skill: ${skillName}\n\n${content}${pluginRootNote}<!-- skillInjection: {"plugin":"sf-docs","skill":"${skillName}"} -->`;

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: context,
      },
    };

    process.stdout.write(JSON.stringify(output));
  } else {
    process.stdout.write('{}');
  }
} catch (err) {
  // Hooks must not crash — fail silently
  process.stdout.write('{}');
}
