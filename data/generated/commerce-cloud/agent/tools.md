# Available Tools

The following sf-docs CLI commands are available for researching Salesforce Commerce Cloud documentation:

## Search

```bash
node ~/.claude/tools/sf-docs/dist/cli.js search "<query>"
```

Semantic search across all ingested commerce docs. Returns top 5 results with relevance scores, snippets, URLs, and file paths.

## Fetch

```bash
node ~/.claude/tools/sf-docs/dist/cli.js fetch "<url>"
```

Fetch and ingest a single Salesforce doc page. Use when you find a referenced article that isn't in the local corpus.

## List

```bash
node ~/.claude/tools/sf-docs/dist/cli.js list commerce
```

List all ingested documents in the commerce area.

## Status

```bash
node ~/.claude/tools/sf-docs/dist/cli.js status
```

Show index and store statistics.
