# Eval System for SF Docs Plugin

Measures and optimizes the quality of generated SME skills.

## Structure

```
evals/
├── quality/          # Binary output-quality evals
│   ├── assertions.ts # Assertion functions (grounding, structural, domain)
│   ├── harness.ts    # Test runner using Anthropic API
│   ├── test-inputs.json  # 15 realistic Salesforce questions
│   └── run.ts        # CLI entrypoint
├── trigger/          # Trigger-precision evals
│   ├── eval-set.json # 20 queries (10 should-trigger, 10 should-not)
│   └── README.md     # Instructions for running trigger evals
├── improve/          # Self-improving loop
│   └── CLAUDE.md     # Instructions for Claude Code improvement iterations
└── README.md         # This file
```

## Prerequisites

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Running Quality Evals

Invoke the generated skill against test inputs and check binary assertions on each output.

```bash
# Standard run
npx tsx evals/quality/run.ts --skill data/generated/commerce-cloud/SKILL.md

# With full output for each input
npx tsx evals/quality/run.ts --skill data/generated/commerce-cloud/SKILL.md --verbose
```

Or use npm scripts:

```bash
npm run eval:quality -- --skill data/generated/commerce-cloud/SKILL.md
npm run eval:quality:verbose -- --skill data/generated/commerce-cloud/SKILL.md
```

Output includes:
- Per-input pass/fail with failing assertion names
- Aggregate failure counts by assertion
- Overall pass rate
- JSON report at `evals/quality/last-report.json`

## Running Trigger Evals

See `evals/trigger/README.md` for instructions on running trigger-precision evals using skill-creator scripts.

## Running the Self-Improving Loop

The improvement loop iteratively edits the SKILL.md based on eval failures:

1. Open a Claude Code session in this project
2. Tell Claude to follow `evals/improve/CLAUDE.md`
3. Specify the target skill: `data/generated/commerce-cloud/SKILL.md`
4. Claude will run evals, read failures, edit the skill, re-run, commit, and repeat

The loop stops when all assertions pass or after 30 iterations.

## Assertions Reference

### Grounding
| Assertion | What It Checks |
|-----------|---------------|
| `citesSource` | References a specific SF doc article title or URL |
| `noHallucinatedUrls` | URLs (if present) are from approved SF domains only |
| `admitsWhenUncovered` | Does not contain fabricated SF object names |

### Structural
| Assertion | What It Checks |
|-----------|---------------|
| `hasStructuredAnswer` | Long answers have headers, bullets, or numbered steps |
| `withinReasonableLength` | Between 50-2000 words |
| `noGenericFiller` | No generic AI filler phrases |

### Domain
| Assertion | What It Checks |
|-----------|---------------|
| `usesCorrectSfTerminology` | Uses proper terms (Buyer Group, Buyer Account) when discussing buyers |
| `mentionsRelevantObjects` | References at least one Commerce-specific term in substantive answers |
| `includesActionableSteps` | Contains step indicators (numbered steps, navigation verbs) |

## Adding New Assertions

1. Add the function to `evals/quality/assertions.ts`
2. Add it to `runAllAssertions()` return object
3. Add a test case in `tests/eval-assertions.test.ts`
4. Add the assertion-to-fix mapping in `evals/improve/CLAUDE.md`
5. Update this README's assertions table

## Adding New Test Inputs

Add entries to `evals/quality/test-inputs.json`:

```json
{
  "id": "category-NN",
  "category": "how-to|troubleshooting|feature-explanation|permissions-licensing|edge-case",
  "question": "The realistic user question"
}
```

Categories: `how-to` (5), `troubleshooting` (3), `feature-explanation` (3), `permissions-licensing` (2), `edge-case` (2).
