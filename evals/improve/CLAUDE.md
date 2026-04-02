# Self-Improving Eval Loop

Run this loop to iteratively improve a generated SME skill based on quality eval failures.
No external API keys required -- Claude Code drives the entire loop.

## Two Levels of Evaluation

### Level 1: Skill-Level Checks (Deterministic)

Checks the SKILL.md instructions directly. Run automatically by `sf-docs update`.

```bash
npx tsx evals/quality/run.ts --skill <target-SKILL.md>
```

These check whether the skill has citation instructions, filler prohibitions, formatting guidance, etc. Failures are auto-fixed by the hardener during `sf-docs update`.

### Level 2: Output-Level Assertions (Claude Code-Driven)

Tests actual answers against the 9 binary assertions. Claude Code acts as both the LLM and the evaluator:

1. Read the target SKILL.md as your system context
2. Read `evals/quality/test-inputs.json` for the 15 test questions
3. Answer each question as if you were the skill (cite Topic Tree titles, use proper terms, include steps)
4. Run each answer through the assertion functions in `evals/quality/assertions.ts`
5. If assertions fail, edit the SKILL.md instructions and repeat

## The Output-Level Loop

Repeat up to 30 iterations:

1. **Read the skill**: Use it as your answering context
2. **Answer test inputs**: Generate a response for each question in `test-inputs.json`
3. **Run assertions**: Apply `runAllAssertions(output, skillContent)` to each response
4. **Read failures**: Identify which assertions failed and on which inputs
5. **Edit ONLY the target SKILL.md** -- never modify files under `evals/`
6. **Repeat** until all assertions pass or 30 iterations reached
7. **Git commit** after each change:
   ```bash
   git add <target-SKILL.md>
   git commit -m "improve: <which assertion(s) addressed>"
   ```

## Assertion-to-Fix Mapping

| Assertion | What It Means | How to Fix the Skill |
|-----------|--------------|---------------------|
| `citesSource` | Output did not reference a specific article title from the Topic Tree | Strengthen citation instructions. Add examples: `Source: [Article Title from Topic Tree]` |
| `noHallucinatedUrls` | Output contained a URL not on help/developer/trailhead.salesforce.com | Strengthen URL policy: never fabricate, cite title instead |
| `admitsWhenUncovered` | Output used fabricated SF object names | Strengthen accuracy section: never invent object/API/field names |
| `hasStructuredAnswer` | Long answer (100+ words) lacked headers, bullets, or numbered steps | Strengthen formatting instructions |
| `withinReasonableLength` | Answer was too short (<50 words) or too long (>2000 words) | Add length guidance: aim for 100-800 words |
| `noGenericFiller` | Output contained generic AI phrases | Strengthen or add prohibited phrases list |
| `usesCorrectSfTerminology` | Discussed buyers without using proper terms (Buyer Group, Buyer Account) | Add terminology reference requiring proper SF Commerce terms |
| `mentionsRelevantObjects` | Substantive answer lacked any Commerce-specific terms | Add instruction to ground answers in specific Commerce objects |
| `includesActionableSteps` | No step indicators found | Strengthen navigation/steps instructions |

## Rules

- **Only edit the SKILL.md file** -- the eval assertions are the ground truth
- Do not weaken assertions to make them pass
- Do not add test-specific hacks to the skill
- Focus on general instructions that improve ALL outputs, not just failing inputs
- If an assertion consistently fails despite reasonable skill edits, note it for manual review
