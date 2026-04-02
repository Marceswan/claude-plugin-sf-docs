/**
 * Self-improving loop: runs eval harness, uses Claude to suggest skill edits
 * based on failures, applies them, and repeats until pass rate is acceptable.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runHarness, type HarnessResult } from './harness.js';
import { callAnthropic } from './anthropic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_INPUTS_PATH = resolve(__dirname, 'test-inputs.json');

const ASSERTION_FIX_MAP: Record<string, string> = {
  citesSource:
    'Output did not reference a specific article title from the Topic Tree. Add instruction to always cite article titles using format: Source: [Article Title from Topic Tree]',
  noHallucinatedUrls:
    'Output contained a URL not on help/developer/trailhead.salesforce.com. Add instruction to never fabricate URLs.',
  admitsWhenUncovered:
    'Output used fabricated SF object names. Add instruction to never invent object or API names -- state "not covered in available documentation" when uncertain.',
  hasStructuredAnswer:
    'Long answer lacked headers, bullets, or numbered steps. Add instruction to structure all answers over 100 words with markdown headers, numbered steps, or bullets.',
  withinReasonableLength:
    'Answer was too short (<50 words) or too long (>2000 words). Add length guidance: aim for 100-800 words.',
  noGenericFiller:
    'Output contained generic AI filler phrases. Add explicit prohibition: never say "as an AI language model", "please consult the official documentation", "it depends on your specific use case", etc.',
  usesCorrectSfTerminology:
    'Discussed buyers without using proper SF terms. Add terminology section requiring: Buyer Group, Buyer Account, Buyer Manager when discussing buyer access.',
  mentionsRelevantObjects:
    'Substantive answer lacked Commerce-specific terms. Add instruction to ground answers in specific Commerce objects: B2B, Catalog, Entitlement, Buyer Group, etc.',
  includesActionableSteps:
    'No step indicators found. Add instruction to include concrete navigation paths (Setup > Commerce > ...) and click-by-click steps for how-to questions.',
};

function buildImprovementPrompt(
  skillContent: string,
  result: HarnessResult,
): string {
  const failureSummary = Object.entries(result.failureCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => {
      const fix = ASSERTION_FIX_MAP[name] || 'Unknown assertion';
      return `- ${name}: ${count}/${result.totalInputs} failed\n  Fix: ${fix}`;
    })
    .join('\n');

  // Include sample failing inputs for context
  const failingExamples = result.results
    .filter((r) => !r.passed)
    .slice(0, 3)
    .map((r) => {
      const failed = Object.entries(r.assertions)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      return `  Q: ${r.question}\n  Failed: ${failed.join(', ')}`;
    })
    .join('\n');

  return `You are editing a Salesforce SME skill file to improve its eval pass rate.

## Current Skill Content

${skillContent}

## Eval Results (${result.totalPassed}/${result.totalInputs} passed, ${(result.passRate * 100).toFixed(1)}% pass rate)

### Failure Counts by Assertion
${failureSummary}

### Sample Failing Inputs
${failingExamples}

## Instructions

Return the COMPLETE improved SKILL.md content. Your edits should:
1. Add or strengthen instructions in the skill body that address each failing assertion
2. Keep the existing frontmatter (name, description) and Topic Tree intact
3. Focus on general instructions that improve ALL outputs, not just the failing samples
4. Do NOT add test-specific hacks or hardcode assertion keywords
5. Do NOT remove or weaken existing instructions that are working
6. Keep the Plugin Root and How to Answer Questions sections unchanged
7. Add new instruction sections BETWEEN "How to Answer Questions" and "Reference Summary"

Return ONLY the complete SKILL.md content, no explanation or markdown fences.`;
}

export interface ImproveResult {
  iterations: number;
  initialPassRate: number;
  finalPassRate: number;
  finalResult: HarnessResult;
  skillContent: string;
}

export async function improveSkill(
  skillPath: string,
  options: {
    maxIterations?: number;
    targetPassRate?: number;
    verbose?: boolean;
  } = {},
): Promise<ImproveResult> {
  const maxIterations = options.maxIterations ?? 5;
  const targetPassRate = options.targetPassRate ?? 1.0;
  const verbose = options.verbose ?? false;

  // Initial eval run
  if (verbose) console.log('Running initial eval...');
  let result = await runHarness(skillPath, TEST_INPUTS_PATH, verbose);
  const initialPassRate = result.passRate;

  if (verbose) {
    console.log(
      `\nInitial: ${result.totalPassed}/${result.totalInputs} passed (${(result.passRate * 100).toFixed(1)}%)`,
    );
  }

  if (result.passRate >= targetPassRate) {
    const skillContent = readFileSync(skillPath, 'utf-8');
    return {
      iterations: 0,
      initialPassRate,
      finalPassRate: result.passRate,
      finalResult: result,
      skillContent,
    };
  }

  let iteration = 0;
  while (iteration < maxIterations && result.passRate < targetPassRate) {
    iteration++;
    if (verbose) {
      console.log(`\n--- Improvement iteration ${iteration}/${maxIterations} ---`);
    }

    const currentSkill = readFileSync(skillPath, 'utf-8');
    const prompt = buildImprovementPrompt(currentSkill, result);

    if (verbose) console.log('Requesting skill improvements from Claude...');
    const improved = await callAnthropic(
      'You are an expert at writing Salesforce SME skill definitions that produce high-quality, grounded answers.',
      prompt,
      { model: 'claude-sonnet-4-20250514', maxTokens: 8192 },
    );

    // Validate the response looks like a skill file
    if (!improved.includes('## Topic Tree') && !improved.includes('## Identity')) {
      if (verbose) console.log('Warning: Claude response does not look like a valid skill. Skipping iteration.');
      continue;
    }

    writeFileSync(skillPath, improved, 'utf-8');
    if (verbose) console.log('Skill updated. Re-running eval...');

    result = await runHarness(skillPath, TEST_INPUTS_PATH, verbose);

    if (verbose) {
      console.log(
        `Iteration ${iteration}: ${result.totalPassed}/${result.totalInputs} passed (${(result.passRate * 100).toFixed(1)}%)`,
      );
    }
  }

  const skillContent = readFileSync(skillPath, 'utf-8');
  return {
    iterations: iteration,
    initialPassRate,
    finalPassRate: result.passRate,
    finalResult: result,
    skillContent,
  };
}
