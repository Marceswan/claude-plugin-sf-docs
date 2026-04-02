# Self-Improving Eval Loop

Run this loop to iteratively improve a generated SME skill based on quality eval failures.

## Prerequisites

- `ANTHROPIC_API_KEY` set in environment
- `tsx` available (`npx tsx` or global install)
- Target skill file exists (e.g., `data/generated/commerce-cloud/SKILL.md`)

## The Loop

Repeat up to 30 iterations:

1. **Run the quality harness**:
   ```bash
   npx tsx evals/quality/run.ts --skill <target-SKILL.md> --verbose
   ```

2. **Read the failure report** at `evals/quality/last-report.json`

3. **Edit ONLY the target SKILL.md** -- never modify files under `evals/`

4. **Re-run** and check if failures decreased

5. **Git commit** after each change:
   ```bash
   git add <target-SKILL.md>
   git commit -m "improve: <which assertion(s) addressed>"
   ```

6. **Stop when**: all assertions pass across all inputs, OR 30 iterations reached

## Assertion-to-Fix Mapping

| Assertion | What It Means | How to Fix the Skill |
|-----------|--------------|---------------------|
| `citesSource` | Output did not reference a specific SF doc article title or URL | Add instruction to always cite article titles from the Topic Tree. Add examples of proper citations: `Source: [Article Title]` |
| `noHallucinatedUrls` | Output contained a URL not on help/developer/trailhead.salesforce.com | Add instruction to never fabricate URLs. If citing, only use help.salesforce.com, developer.salesforce.com, or trailhead.salesforce.com |
| `admitsWhenUncovered` | Output used fabricated SF object names | Add instruction to never invent object or API names. State "not covered in available documentation" when uncertain |
| `hasStructuredAnswer` | Long answer (100+ words) lacked headers, bullets, or numbered steps | Add instruction to structure all substantive answers with headers, numbered steps, or bullets |
| `withinReasonableLength` | Answer was too short (<50 words) or too long (>2000 words) | Add length guidance: aim for 100-800 words. Be thorough but concise |
| `noGenericFiller` | Output contained generic AI phrases like "as an AI language model" | Add explicit prohibition of filler phrases. List the banned phrases in the skill |
| `usesCorrectSfTerminology` | Discussed buyers without using proper terms (Buyer Group, Buyer Account) | Add terminology reference section requiring proper SF Commerce terms |
| `mentionsRelevantObjects` | Substantive answer lacked any Commerce-specific terms | Add instruction to always ground answers in specific Commerce objects and features |
| `includesActionableSteps` | No step indicators (numbered steps, "Navigate to", "Click", etc.) | Add instruction to include concrete navigation paths and click-by-click steps where applicable |

## Rules

- **Only edit the SKILL.md file** -- the eval assertions are the ground truth
- Do not weaken assertions to make them pass
- Do not add test-specific hacks to the skill (e.g., hardcoding assertion keywords)
- Focus on general instructions that improve ALL outputs, not just failing inputs
- If an assertion consistently fails despite reasonable skill edits, note it as a potential assertion issue for manual review

## Example Iteration

```
Iteration 3:
- Ran eval: 11/15 pass, 4 fail
- Failures: citesSource (3), includesActionableSteps (2)
- Edit: Added "Always cite the specific article title from the Topic Tree using format: Source: [Article Title]" to skill instructions
- Edit: Added "Include step-by-step navigation paths (Setup > Commerce > ...) when answering how-to questions"
- Re-ran: 14/15 pass, 1 fail
- Committed: "improve: citesSource and includesActionableSteps instructions"
```
