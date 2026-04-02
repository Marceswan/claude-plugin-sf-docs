/**
 * Skill-level assertions: check that a SKILL.md contains the instructions
 * needed to produce high-quality outputs. These are deterministic checks
 * against the skill file itself -- no LLM calls required.
 */

import { extractTopicTreeTitles } from './assertions.js';

export interface SkillCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface SkillCheckResult {
  skillPath: string;
  checks: SkillCheck[];
  passed: number;
  failed: number;
  total: number;
  passRate: number;
}

/**
 * Checks that the skill has a Topic Tree with at least 5 article titles.
 */
function hasTopicTree(content: string): SkillCheck {
  const titles = extractTopicTreeTitles(content);
  const passed = titles.length >= 5;
  return {
    name: 'hasTopicTree',
    passed,
    message: passed
      ? `Topic Tree has ${titles.length} articles`
      : `Topic Tree has only ${titles.length} articles (need 5+)`,
  };
}

/**
 * Checks for citation instructions -- skill must tell the LLM to cite
 * article titles from the Topic Tree.
 */
function hasCitationInstructions(content: string): SkillCheck {
  const lower = content.toLowerCase();
  const patterns = [
    /cite.*article/i,
    /source:\s*\[/i,
    /cite.*topic tree/i,
    /reference.*topic tree/i,
    /cite.*specific/i,
    /article title/i,
  ];
  const passed = patterns.some((p) => p.test(content));
  return {
    name: 'hasCitationInstructions',
    passed,
    message: passed
      ? 'Skill instructs citation of article titles'
      : 'Missing: instruction to cite specific article titles from Topic Tree',
  };
}

/**
 * Checks for URL grounding instructions -- skill must prohibit fabricated URLs.
 */
function hasUrlGrounding(content: string): SkillCheck {
  const patterns = [
    /do not (fabricate|invent|guess|make up).*url/i,
    /never (fabricate|invent|guess|make up).*url/i,
    /only.*url.*help\.salesforce|developer\.salesforce|trailhead/i,
    /do not guess/i,
    /don't guess/i,
  ];
  const passed = patterns.some((p) => p.test(content));
  return {
    name: 'hasUrlGrounding',
    passed,
    message: passed
      ? 'Skill prohibits fabricated URLs'
      : 'Missing: instruction to never fabricate URLs',
  };
}

/**
 * Checks for filler prohibition -- skill must ban generic AI phrases.
 */
function hasFillerProhibition(content: string): SkillCheck {
  const lower = content.toLowerCase();
  const hasProhibition =
    lower.includes('never say') ||
    lower.includes('do not say') ||
    lower.includes('do not use phrases') ||
    lower.includes('never use phrases') ||
    lower.includes('avoid phrases') ||
    lower.includes('prohibited phrases') ||
    lower.includes('banned phrases') ||
    lower.includes('filler');
  return {
    name: 'hasFillerProhibition',
    passed: hasProhibition,
    message: hasProhibition
      ? 'Skill prohibits generic AI filler phrases'
      : 'Missing: prohibition of generic AI filler phrases',
  };
}

/**
 * Checks for structural formatting instructions.
 */
function hasFormattingInstructions(content: string): SkillCheck {
  const patterns = [
    /structure.*answer/i,
    /use.*headers/i,
    /numbered.*steps/i,
    /bullet/i,
    /markdown.*format/i,
    /format.*response/i,
  ];
  const passed = patterns.some((p) => p.test(content));
  return {
    name: 'hasFormattingInstructions',
    passed,
    message: passed
      ? 'Skill instructs structured answer formatting'
      : 'Missing: instruction to structure answers with headers, steps, or bullets',
  };
}

/**
 * Checks for actionable step instructions.
 */
function hasActionableStepInstructions(content: string): SkillCheck {
  const patterns = [
    /navigation.*path/i,
    /step.by.step/i,
    /click.by.click/i,
    /setup\s*>/i,
    /navigate to/i,
    /include.*steps/i,
    /actionable/i,
    /how.to.*include.*navigation/i,
  ];
  const passed = patterns.some((p) => p.test(content));
  return {
    name: 'hasActionableStepInstructions',
    passed,
    message: passed
      ? 'Skill instructs actionable steps with navigation paths'
      : 'Missing: instruction to include step-by-step navigation paths',
  };
}

/**
 * Checks for hallucination guardrail -- skill must instruct not to invent
 * object/API names.
 */
function hasHallucinationGuardrail(content: string): SkillCheck {
  const patterns = [
    /do not (invent|fabricate|guess|make up).*(?:object|api|field|name)/i,
    /never (invent|fabricate|guess|make up)/i,
    /don't.*cover.*say so/i,
    /if.*(?:docs|documentation).*(?:don't|do not).*cover/i,
    /do not guess/i,
  ];
  const passed = patterns.some((p) => p.test(content));
  return {
    name: 'hasHallucinationGuardrail',
    passed,
    message: passed
      ? 'Skill guards against hallucinated names'
      : 'Missing: instruction not to invent object/API/field names',
  };
}

/**
 * Checks the skill has a Reference Summary / Topic Tree section
 * with actual content (not empty).
 */
function hasReferenceContent(content: string): SkillCheck {
  const titles = extractTopicTreeTitles(content);
  const hasConcepts = /## Key Concepts/.test(content);
  const passed = titles.length > 0 || hasConcepts;
  return {
    name: 'hasReferenceContent',
    passed,
    message: passed
      ? `Reference content present (${titles.length} topics${hasConcepts ? ' + concepts' : ''})`
      : 'Missing: Reference Summary section is empty',
  };
}

/**
 * Run all skill-level checks against a SKILL.md content string.
 */
export function runSkillChecks(content: string, skillPath: string): SkillCheckResult {
  const checks = [
    hasTopicTree(content),
    hasReferenceContent(content),
    hasCitationInstructions(content),
    hasUrlGrounding(content),
    hasFillerProhibition(content),
    hasFormattingInstructions(content),
    hasActionableStepInstructions(content),
    hasHallucinationGuardrail(content),
  ];

  const passed = checks.filter((c) => c.passed).length;
  return {
    skillPath,
    checks,
    passed,
    failed: checks.length - passed,
    total: checks.length,
    passRate: checks.length > 0 ? passed / checks.length : 0,
  };
}
