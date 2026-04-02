/**
 * Deterministic skill hardener: reads a SKILL.md, runs skill-level checks,
 * and injects missing instruction sections. No LLM calls -- pure string ops.
 */

import { readFileSync, writeFileSync } from 'fs';
import { runSkillChecks, type SkillCheckResult } from './skill-checks.js';

/**
 * Instruction blocks to inject when a check fails.
 * Keyed by check name. Each value is a markdown section to insert.
 */
const FIX_BLOCKS: Record<string, string> = {
  hasCitationInstructions: `## Citation Requirements

- Always cite specific article titles from the Topic Tree when they are relevant
- Format citations as: Source: [Article Title from Topic Tree]
- When multiple articles are relevant, cite all of them
- If the Topic Tree does not cover the question, state that explicitly`,

  hasUrlGrounding: `## URL Policy

- Never fabricate or guess URLs
- Only reference URLs from: help.salesforce.com, developer.salesforce.com, trailhead.salesforce.com
- If you do not have the exact URL, cite the article title instead`,

  hasFillerProhibition: `## Prohibited Phrases

Never use these or similar generic filler:
- "As an AI language model..."
- "I don't have access to real-time..."
- "Please consult the official documentation"
- "I'd recommend reaching out to Salesforce support"
- "It depends on your specific use case"

Lead with the answer. If you lack information, state what is missing specifically.`,

  hasFormattingInstructions: `## Answer Format

- Structure all answers over 100 words with markdown headers, numbered steps, or bullet points
- Use numbered steps for how-to and configuration procedures
- Use bullets for lists of considerations, features, or options
- Use headers (##, ###) to separate distinct topics within a response
- Keep answers between 100-800 words unless the question demands more`,

  hasActionableStepInstructions: `## Navigation and Steps

- For how-to questions, include step-by-step navigation paths (e.g., Setup > Commerce > Stores)
- Use action verbs: Navigate to, Click, Select, Enable, Go to
- Reference the specific UI location: Setup, Commerce App, Experience Builder, Store Workspace
- Include prerequisite steps when relevant (permissions, feature enablement)`,

  hasHallucinationGuardrail: `## Accuracy Requirements

- Never invent Salesforce object names, API names, field names, or permission names
- If unsure whether a feature exists or an object name is correct, say so explicitly
- Do not guess at configuration steps -- if the docs do not cover it, state that
- Distinguish between standard objects and custom objects when referencing schema`,
};

/** Injection point: insert new sections BEFORE the Reference Summary */
const INJECTION_MARKERS = [
  '\n## Reference Summary',
  '\n## Topic Tree',
];

function findInjectionPoint(content: string): number {
  for (const marker of INJECTION_MARKERS) {
    const idx = content.indexOf(marker);
    if (idx !== -1) return idx;
  }
  // Fallback: end of file
  return content.length;
}

export interface HardenResult {
  checkResult: SkillCheckResult;
  applied: string[];
  alreadyPassing: string[];
  finalContent: string;
}

/**
 * Harden a skill file by running checks and injecting missing instruction blocks.
 * Returns the check results and the hardened content.
 */
export function hardenSkill(skillPath: string): HardenResult {
  const content = readFileSync(skillPath, 'utf-8');
  const checkResult = runSkillChecks(content, skillPath);

  const applied: string[] = [];
  const alreadyPassing: string[] = [];
  const blocksToInject: string[] = [];

  for (const check of checkResult.checks) {
    if (check.passed) {
      alreadyPassing.push(check.name);
      continue;
    }
    const fix = FIX_BLOCKS[check.name];
    if (fix) {
      blocksToInject.push(fix);
      applied.push(check.name);
    }
    // Checks without fix blocks (hasTopicTree, hasReferenceContent) are
    // structural -- they require re-crawling, not instruction injection
  }

  let finalContent = content;
  if (blocksToInject.length > 0) {
    const injectionPoint = findInjectionPoint(content);
    const before = content.slice(0, injectionPoint);
    const after = content.slice(injectionPoint);
    finalContent = before + '\n\n' + blocksToInject.join('\n\n') + '\n' + after;

    writeFileSync(skillPath, finalContent, 'utf-8');
  }

  return { checkResult, applied, alreadyPassing, finalContent };
}
