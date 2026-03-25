import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const skipFiles = new Set([
  'src/lib/metrics/domains.ts',
]);

// Lines matching these patterns won't be modified (domain color map keys)
const SKIP_LINE_PATTERNS = [
  /["']emerald-\d+["']\s*:/,   // domain color map keys like "emerald-400":
];

// Success/semantic greens to PRESERVE (don't replace these)
const PRESERVE_PATTERNS = [
  // Health dot - in range (green)
  /healthDot.*green/,
  // win indicators
  /result.*win.*emerald/,
  /win.*emerald/,
  // sleep score good
  /sleep_score.*emerald/,
  // connected status
  /connected.*emerald/,
  // checkmark / confirmation
  /Check.*emerald/,
  /check.*emerald/,
];

// Specific patterns to keep as-is (exact strings that are semantic success states)
// We'll handle these on a per-token basis
const SEMANTIC_EMERALD = new Set([
  // These class strings represent semantic success - we check for adjacent context
]);

const replacements = [
  ['emerald-950', 'blue-950'],
  ['emerald-900', 'blue-900'],
  ['emerald-800', 'blue-800'],
  ['emerald-700', 'blue-700'],
  ['emerald-600', 'blue-600'],
  ['emerald-500', 'blue-500'],
  ['emerald-400', 'blue-400'],
  ['emerald-300', 'blue-300'],
  ['emerald-200', 'blue-200'],
  ['emerald-100', 'blue-100'],
  ['emerald-50', 'blue-50'],
];

function shouldSkipLine(line) {
  for (const pat of SKIP_LINE_PATTERNS) {
    if (pat.test(line)) return true;
  }
  return false;
}

function processFile(filePath, relPath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let changed = false;

  const newLines = lines.map(line => {
    if (shouldSkipLine(line)) return line;

    let newLine = line;
    for (const [from, to] of replacements) {
      if (newLine.includes(from)) {
        newLine = newLine.replaceAll(from, to);
        changed = true;
      }
    }
    return newLine;
  });

  if (changed) {
    writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log('Updated:', relPath);
  }
}

function walk(dir, root) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const rel = full.slice(root.length + 1).replace(/\\/g, '/');
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git', 'scripts'].includes(entry)) continue;
      walk(full, root);
    } else {
      const ext = extname(entry);
      if (!['.ts', '.tsx', '.css', '.js', '.jsx'].includes(ext)) continue;
      if (skipFiles.has(rel)) {
        console.log('Skipping:', rel);
        continue;
      }
      processFile(full, rel);
    }
  }
}

const root = process.cwd();
console.log('Running in:', root);
walk(join(root, 'src'), root);
console.log('Done!');
