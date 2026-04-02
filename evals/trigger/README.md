# Trigger Precision Evals

Tests whether the skill's `description` field correctly routes queries to the sf-docs skill.

## Eval Set

`eval-set.json` contains 20 queries:

- **10 should-trigger**: Queries that the sf-docs skill should handle
- **10 should-not-trigger**: Near-miss queries that share keywords but belong elsewhere

## Running Trigger Evals

Trigger evals use the skill-creator `eval` command from the anthropics/skills repo. The eval checks whether the skill description in the SKILL.md frontmatter causes the skill to trigger for each query.

### With skill-creator scripts

```bash
# From the skills repo root
npx skill-creator eval \
  --skill path/to/data/generated/commerce-cloud/SKILL.md \
  --eval-set path/to/evals/trigger/eval-set.json
```

### Manual approach

If you don't have the skill-creator scripts, you can evaluate manually:

1. Extract the `description` field from the SKILL.md frontmatter
2. For each query in eval-set.json, determine if the description would cause the skill to be selected
3. Compare against the `should_trigger` / `should_not_trigger` classification
4. Calculate precision (true positives / predicted positives) and recall (true positives / actual positives)

### Interpreting Results

- **False negatives** (should-trigger but didn't): The description is too narrow. Add relevant terms.
- **False positives** (should-not-trigger but did): The description is too broad. Add exclusion context or narrow the scope.
- Target: 90%+ on both precision and recall.

## Adding New Queries

Add entries to `eval-set.json` following the existing format. Each entry needs:

- `id`: Unique identifier (e.g., `trigger-11` or `notrigger-11`)
- `query`: The user's question (realistic, messy -- include typos, abbreviations, backstory)
- `reason`: Why this query should or should not trigger the skill
