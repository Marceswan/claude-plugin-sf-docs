# Eval System for SF Docs Plugin

Measures and optimizes the quality of generated SME skills. Fully self-contained -- no external API keys required.

## Structure

```
evals/
├── quality/          # Quality evaluation
│   ├── assertions.ts # Output-level assertion functions (grounding, structural, domain)
│   ├── skill-checks.ts  # Skill-level checks (deterministic, no LLM)
│   ├── hardener.ts   # Auto-applies fixes for failing skill-level checks
│   ├── harness.ts    # Output-level eval runner (for Claude Code to drive)
│   ├── test-inputs.json  # 15 realistic Salesforce questions
│   └── run.ts        # CLI for skill-level checks
├── trigger/          # Trigger-precision evals
│   ├── eval-set.json # 20 queries (10 should-trigger, 10 should-not)
│   └── README.md     # Instructions for running trigger evals
├── improve/          # Self-improving loop
│   └── CLAUDE.md     # Instructions for Claude Code improvement iterations
└── README.md         # This file
```

## Two Levels of Evaluation

### Level 1: Skill-Level Checks (Deterministic)

Checks the SKILL.md instructions directly -- does it have citation instructions, filler prohibitions, formatting guidance, etc. Runs automatically during `sf-docs update` and auto-fixes failures.

```bash
# Standalone check
npx tsx evals/quality/run.ts --skill data/generated/commerce-cloud/SKILL.md

# Via update command (crawls, regenerates, and hardens)
sf-docs update commerce-cloud --verbose
```

### Level 2: Output-Level Assertions (Claude Code-Driven)

Tests actual generated answers against 9 binary assertions. Claude Code IS the LLM -- no separate API call needed.

1. Read the skill and `evals/quality/test-inputs.json`
2. Answer each question using the skill as context
3. Run `runAllAssertions(output, skillContent)` from `assertions.ts` against each answer
4. Follow `evals/improve/CLAUDE.md` for the iterative improvement loop

## Running Trigger Evals

See `evals/trigger/README.md`.

## Assertions Reference

### Grounding
| Assertion | What It Checks |
|-----------|---------------|
| `citesSource` | References a specific article title from the Topic Tree or valid SF URL |
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
5. For skill-level checks, add a check function to `evals/quality/skill-checks.ts` and a fix block to `evals/quality/hardener.ts`

## Adding New Test Inputs

Add entries to `evals/quality/test-inputs.json`:

```json
{
  "id": "category-NN",
  "category": "how-to|troubleshooting|feature-explanation|permissions-licensing|edge-case",
  "question": "The realistic user question"
}
```
