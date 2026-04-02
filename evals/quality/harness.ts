/**
 * Test harness that invokes a generated skill against test inputs
 * using the Anthropic API, then runs binary assertions on each output.
 */

import { readFileSync } from 'fs';
import { runAllAssertions } from './assertions.js';

interface TestInput {
  id: string;
  category: string;
  question: string;
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

async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required. Set it before running evals.',
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock?.text ?? '';
}

function buildSystemPrompt(skillContent: string): string {
  return `${skillContent}

## Important Context for This Session

The local docs search CLI (\`node "$PLUGIN_ROOT/dist/cli.js" search\`) is NOT available in this context. You cannot run shell commands or use the Read tool.

Instead, answer questions using:
1. The Topic Tree provided in the Reference Summary above -- cite specific article titles from it
2. Your knowledge of Salesforce Commerce features and configuration

You MUST cite specific article titles from the Topic Tree when they are relevant to the question. Format citations as: Source: [Article Title]

If the topic tree does not cover a question, state that explicitly rather than guessing.`;
}

export async function runHarness(
  skillPath: string,
  testInputsPath: string,
  verbose: boolean = false,
): Promise<HarnessResult> {
  const skillContent = readFileSync(skillPath, 'utf-8');
  const testInputs: TestInput[] = JSON.parse(
    readFileSync(testInputsPath, 'utf-8'),
  );
  const systemPrompt = buildSystemPrompt(skillContent);

  const failureCounts: Record<string, number> = {};
  const results: AssertionResult[] = [];

  for (const input of testInputs) {
    if (verbose) {
      process.stdout.write(`  [${input.id}] ${input.question.slice(0, 60)}...`);
    }

    try {
      const output = await callAnthropic(systemPrompt, input.question);
      const assertions = runAllAssertions(output, skillContent);
      const passed = Object.values(assertions).every(Boolean);

      for (const [name, result] of Object.entries(assertions)) {
        if (!result) {
          failureCounts[name] = (failureCounts[name] || 0) + 1;
        }
      }

      const result: AssertionResult = {
        inputId: input.id,
        question: input.question,
        assertions,
        passed,
      };

      if (verbose) {
        result.output = output;
      }

      results.push(result);

      if (verbose) {
        const status = passed ? ' PASS' : ' FAIL';
        const failedNames = Object.entries(assertions)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        console.log(
          status + (failedNames.length ? ` [${failedNames.join(', ')}]` : ''),
        );
      }
    } catch (err) {
      console.error(`  [${input.id}] ERROR: ${(err as Error).message}`);
      results.push({
        inputId: input.id,
        question: input.question,
        assertions: {},
        passed: false,
      });
    }
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
