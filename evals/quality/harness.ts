/**
 * Output-level eval harness. Runs binary assertions against pre-generated
 * answers. Designed to be driven by Claude Code -- Claude Code generates
 * the answers (it IS the LLM), then feeds them here for deterministic checks.
 *
 * No external API calls. No ANTHROPIC_API_KEY required.
 */

import { readFileSync } from 'fs';
import { runAllAssertions } from './assertions.js';

export interface TestInput {
  id: string;
  category: string;
  question: string;
}

export interface EvalEntry {
  input: TestInput;
  output: string;
}

interface AssertionResult {
  inputId: string;
  question: string;
  assertions: Record<string, boolean>;
  passed: boolean;
  output?: string;
}

export interface HarnessResult {
  skillPath: string;
  totalInputs: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
  failureCounts: Record<string, number>;
  results: AssertionResult[];
}

/**
 * Run assertions against a set of pre-generated outputs.
 *
 * @param entries - Array of { input, output } pairs. Claude Code generates
 *   the output by answering each question using the skill as context.
 * @param skillPath - Path to the SKILL.md (used in the report)
 * @param skillContent - The skill file content (passed to skill-aware assertions)
 * @param verbose - Include full output text in results
 */
export function evaluateOutputs(
  entries: EvalEntry[],
  skillPath: string,
  skillContent: string,
  verbose: boolean = false,
): HarnessResult {
  const failureCounts: Record<string, number> = {};
  const results: AssertionResult[] = [];

  for (const entry of entries) {
    const assertions = runAllAssertions(entry.output, skillContent);
    const passed = Object.values(assertions).every(Boolean);

    for (const [name, result] of Object.entries(assertions)) {
      if (!result) {
        failureCounts[name] = (failureCounts[name] || 0) + 1;
      }
    }

    const assertionResult: AssertionResult = {
      inputId: entry.input.id,
      question: entry.input.question,
      assertions,
      passed,
    };

    if (verbose) {
      assertionResult.output = entry.output;
    }

    results.push(assertionResult);
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.length - totalPassed;

  return {
    skillPath,
    totalInputs: results.length,
    totalPassed,
    totalFailed,
    passRate: results.length > 0 ? totalPassed / results.length : 0,
    failureCounts,
    results,
  };
}

/**
 * Load test inputs from the JSON file.
 */
export function loadTestInputs(path: string): TestInput[] {
  return JSON.parse(readFileSync(path, 'utf-8'));
}
