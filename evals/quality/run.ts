#!/usr/bin/env tsx
/**
 * CLI entrypoint for running quality evals against a generated skill.
 *
 * Usage:
 *   npx tsx evals/quality/run.ts --skill <path-to-SKILL.md>
 *   npx tsx evals/quality/run.ts --skill <path> --verbose
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runHarness, type HarnessResult } from './harness.js';

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

function printReport(result: HarnessResult): void {
  console.log('\n' + '='.repeat(70));
  console.log('QUALITY EVAL REPORT');
  console.log('='.repeat(70));
  console.log(`Skill: ${result.skillPath}`);
  console.log(`Inputs: ${result.totalInputs}`);
  console.log(`Passed: ${result.totalPassed}`);
  console.log(`Failed: ${result.totalFailed}`);
  console.log(`Pass rate: ${(result.passRate * 100).toFixed(1)}%`);

  if (Object.keys(result.failureCounts).length > 0) {
    console.log('\nFailure counts by assertion:');
    const sorted = Object.entries(result.failureCounts).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [name, count] of sorted) {
      console.log(`  ${name}: ${count}/${result.totalInputs} failed`);
    }
  }

  console.log('\nPer-input results:');
  for (const r of result.results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const failedAssertions = Object.entries(r.assertions)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    const detail = failedAssertions.length
      ? ` -- failed: ${failedAssertions.join(', ')}`
      : '';
    console.log(`  [${r.inputId}] ${status}${detail}`);
  }

  if (result.results.some((r) => r.output)) {
    console.log('\n' + '-'.repeat(70));
    console.log('VERBOSE OUTPUT');
    console.log('-'.repeat(70));
    for (const r of result.results) {
      if (r.output) {
        console.log(`\n--- [${r.inputId}] ${r.question} ---`);
        console.log(r.output);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
}

async function main(): Promise<void> {
  const { skillPath, verbose } = parseArgs();
  const testInputsPath = resolve(__dirname, 'test-inputs.json');

  console.log(`Running quality evals against: ${skillPath}`);
  console.log(`Verbose: ${verbose}\n`);

  const result = await runHarness(skillPath, testInputsPath, verbose);
  printReport(result);

  // Write JSON report to stdout-adjacent file for programmatic consumption
  const reportPath = resolve(__dirname, 'last-report.json');
  const { writeFileSync } = await import('fs');
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\nJSON report written to: ${reportPath}`);

  // Exit with error code if any failures
  if (result.totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
