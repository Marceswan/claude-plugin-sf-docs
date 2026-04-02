#!/usr/bin/env tsx
/**
 * CLI entrypoint for the skill improvement loop.
 * Called by `sf-docs update` as a subprocess.
 *
 * Usage:
 *   npx tsx evals/quality/improve-cli.ts --skill <path> [--max-iterations N] [--verbose]
 *
 * Outputs JSON result to stdout on success.
 */

import { resolve } from 'path';
import { improveSkill } from './improver.js';

function parseArgs(): { skillPath: string; maxIterations: number; verbose: boolean } {
  const args = process.argv.slice(2);
  let skillPath = '';
  let maxIterations = 5;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skill' && args[i + 1]) {
      skillPath = args[++i];
    } else if (args[i] === '--max-iterations' && args[i + 1]) {
      maxIterations = parseInt(args[++i], 10);
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  if (!skillPath) {
    process.stderr.write('Usage: improve-cli.ts --skill <path> [--max-iterations N] [--verbose]\n');
    process.exit(1);
  }

  return { skillPath: resolve(skillPath), maxIterations, verbose };
}

async function main(): Promise<void> {
  const { skillPath, maxIterations, verbose } = parseArgs();

  // Verbose output goes to stderr so stdout is clean JSON
  if (verbose) process.stderr.write(`Improving: ${skillPath} (max ${maxIterations} iterations)\n`);

  const result = await improveSkill(skillPath, {
    maxIterations,
    verbose,
  });

  // Final result as JSON to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
