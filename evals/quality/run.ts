#!/usr/bin/env tsx
/**
 * CLI entrypoint for running skill-level quality checks.
 * For output-level evals, use Claude Code to drive the harness interactively.
 *
 * Usage:
 *   npx tsx evals/quality/run.ts --skill <path-to-SKILL.md>
 *   npx tsx evals/quality/run.ts --skill <path> --verbose
 */

import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { runSkillChecks } from './skill-checks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): { skillPath: string; verbose: boolean } {
  const args = process.argv.slice(2);
  let skillPath = '';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skill' && args[i + 1]) {
      skillPath = args[++i];
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  if (!skillPath) {
    console.error('Usage: npx tsx evals/quality/run.ts --skill <path-to-SKILL.md> [--verbose]');
    process.exit(1);
  }

  return { skillPath: resolve(skillPath), verbose };
}

function main(): void {
  const { skillPath, verbose } = parseArgs();

  const content = readFileSync(skillPath, 'utf-8');
  const result = runSkillChecks(content, skillPath);

  console.log('='.repeat(60));
  console.log('SKILL QUALITY CHECK');
  console.log('='.repeat(60));
  console.log(`Skill: ${skillPath}`);
  console.log(`Passed: ${result.passed}/${result.total}`);
  console.log(`Pass rate: ${(result.passRate * 100).toFixed(1)}%`);

  console.log('\nChecks:');
  for (const check of result.checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.name}: ${check.message}`);
  }

  if (verbose) {
    console.log('\nFor output-level eval (testing actual answers), use Claude Code:');
    console.log('  1. Read the skill and test-inputs.json');
    console.log('  2. Answer each question using the skill as context');
    console.log('  3. Run assertions from assertions.ts against each answer');
    console.log('  4. Follow evals/improve/CLAUDE.md for the improvement loop');
  }

  console.log('='.repeat(60));

  if (result.failed > 0) {
    process.exit(1);
  }
}

main();
