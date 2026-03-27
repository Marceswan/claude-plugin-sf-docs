---
name: sf-docs
description: Search, fetch, and crawl Salesforce documentation from help.salesforce.com. Use when looking up SF features, configuration steps, or reference docs.
---

# SF Docs - Salesforce Documentation Search & Ingestion

## Pre-flight Check

Before running any command, verify the tool is built. The CLI lives in the sf-docs plugin directory. Determine the plugin root by checking where this skill was loaded from, or use the path provided in the hook injection context.

```bash
# The plugin root is where this skill's SKILL.md lives, two levels up from skills/sf-docs/
# Find it by searching for the sf-docs plugin
PLUGIN_ROOT=$(dirname "$(dirname "$(find ~/.claude/plugins/cache -path "*/sf-docs/skills/sf-docs/SKILL.md" 2>/dev/null | head -1)")")
test -f "$PLUGIN_ROOT/dist/cli.js" || (cd "$PLUGIN_ROOT" && npm run setup)
```

## Commands

All commands run via: `node "$PLUGIN_ROOT/dist/cli.js" <command>`

Where `$PLUGIN_ROOT` is the sf-docs plugin installation directory. If the hook injected this skill, the plugin root path was provided in the injection context.

### Search (most common)
```bash
node "$PLUGIN_ROOT/dist/cli.js" search "your query here"
```
- Returns top 5 results with relevance scores, snippets (max 500 chars), URLs, and file paths
- After getting results, use the Read tool on the file path if you need more detail from a specific result
- Do NOT bulk-read all result files - only read the most relevant one

### Fetch (single page)
```bash
node "$PLUGIN_ROOT/dist/cli.js" fetch "https://help.salesforce.com/s/articleView?id=<id>&type=5"
```
- Renders the JS page via headless browser, converts to markdown, indexes for search
- Takes 5-15 seconds per page (first run downloads the embedding model ~22MB)

### Crawl (bulk ingest)
```bash
node "$PLUGIN_ROOT/dist/cli.js" crawl "https://help.salesforce.com/s/articleView?id=<id>&type=5" --depth 2
```
- Crawls linked SF articles starting from the given page
- `--depth 0` = just this page, `--depth 1` = + linked pages, `--depth 2` = + their links
- Stays within the same doc area by default. Add `--no-scope` for cross-area
- Skips pages fetched in the last 30 days. Add `--force` to re-fetch all
- Add `--name <name>` to register the crawl for future updates

### List / Status
```bash
node "$PLUGIN_ROOT/dist/cli.js" list [area]
node "$PLUGIN_ROOT/dist/cli.js" status
```

### Remove / Rebuild
```bash
node "$PLUGIN_ROOT/dist/cli.js" remove <article-id>
node "$PLUGIN_ROOT/dist/cli.js" rebuild-index
```

### Update (re-crawl registered docs)
```bash
node "$PLUGIN_ROOT/dist/cli.js" update <crawl-name>       # Re-crawl one
node "$PLUGIN_ROOT/dist/cli.js" update --all              # Re-crawl all
node "$PLUGIN_ROOT/dist/cli.js" update <crawl-name> --force  # Force re-fetch
```
- Re-crawls using stored settings (URL, depth, scope)
- Register a crawl with `crawl <url> --name <name>`

### List registered crawls
```bash
node "$PLUGIN_ROOT/dist/cli.js" crawls
```

### Generate SME skill or agent
```bash
node "$PLUGIN_ROOT/dist/cli.js" generate skill <crawl-name>   # SKILL.md for inline Q&A
node "$PLUGIN_ROOT/dist/cli.js" generate agent <crawl-name>   # Agent definition for autonomous research
```
- Skills produce a `SKILL.md` with domain knowledge and search instructions
- Agents produce `agent.md` (system prompt) + `tools.md` (tool reference)
- Output defaults to `data/generated/<crawl-name>/`; override with `--output <path>`

## When to Use Proactively

Search the SF docs index when:
- The user asks about a specific Salesforce feature or configuration and you are not confident in your answer
- The user references a SF Help article or doc page
- You need to verify a configuration step or feature behavior

Do NOT search on every Salesforce question - only when you are uncertain or the answer requires specific doc-level detail.

## Technical Details

- **Embeddings:** Local only (all-MiniLM-L6-v2 via @huggingface/transformers). No API keys needed.
- **Vector DB:** Vectra (file-based JSON index). No server process needed.
- **Browser:** Playwright Chromium (headless). Required because SF docs are JS-rendered.
- **Storage:** Markdown files in the plugin's `data/docs/<area>/<id>.md` directory.
