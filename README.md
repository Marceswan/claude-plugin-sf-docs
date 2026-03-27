# sf-docs — Claude Code Plugin

Ingest Salesforce documentation locally, search it semantically, and generate domain-specific SME (Subject Matter Expert) skills and agents — all without API keys or cloud services.

## Table of Contents

- [What This Plugin Does](#what-this-plugin-does)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Commands Reference](#commands-reference)
- [Auto-Injection Hook](#auto-injection-hook)
- [Generating SME Skills and Agents](#generating-sme-skills-and-agents)
- [Updating Documentation](#updating-documentation)
- [Plugin Structure](#plugin-structure)
- [Troubleshooting](#troubleshooting)

## What This Plugin Does

This plugin gives Claude Code deep access to Salesforce documentation by:

1. **Crawling** Salesforce Help articles via headless browser (SF docs are JS-rendered)
2. **Storing** them as local markdown files
3. **Indexing** them with vector embeddings for semantic search
4. **Auto-injecting** the skill into your session when you work on Salesforce projects
5. **Generating** specialized SME skills and agents from the crawled docs

Everything runs locally. Embeddings use a local HuggingFace model (`all-MiniLM-L6-v2`). No API keys, no cloud services, no data leaves your machine.

## Prerequisites

- **Node.js 18+** (22+ recommended)
- **Claude Code** CLI installed
- Playwright Chromium is auto-installed during plugin setup

## Installation

```bash
claude plugin add github:Marceswan/claude-plugin-sf-docs
```

This clones the repo, installs dependencies, compiles TypeScript, and installs Playwright Chromium automatically.

### Verify Installation

After installation, confirm the plugin is active:

```bash
# The sf-docs skill should appear in your skills list
# You can also test the CLI directly:
node "$(find ~/.claude/plugins/cache -path '*/sf-docs/dist/cli.js' 2>/dev/null | head -1)" status
```

## Getting Started

### Step 1: Crawl Documentation

Pick a Salesforce documentation area and crawl it. The `--depth` flag controls how many levels of linked articles to follow. The `--name` flag registers the crawl for future updates.

```bash
# Example: Crawl Commerce Cloud docs (depth 3 = ~400 articles, takes 15-20 min)
node "$PLUGIN_ROOT/dist/cli.js" crawl \
  "https://help.salesforce.com/s/articleView?id=commerce.comm_intro.htm&type=5" \
  --depth 3 --name commerce-cloud
```

**Choosing depth:**
| Depth | Coverage | Time |
|-------|----------|------|
| 0 | Just the starting page | ~10 seconds |
| 1 | Starting page + all linked pages | 1-3 minutes |
| 2 | + pages linked from those (default) | 5-10 minutes |
| 3 | Deep crawl, comprehensive coverage | 15-30 minutes |

**Other doc areas you might want to crawl:**

```bash
# Apex development
node "$PLUGIN_ROOT/dist/cli.js" crawl \
  "https://help.salesforce.com/s/articleView?id=sf.apex_dev_guide.htm&type=5" \
  --depth 2 --name apex-dev

# Flow Builder
node "$PLUGIN_ROOT/dist/cli.js" crawl \
  "https://help.salesforce.com/s/articleView?id=sf.flow.htm&type=5" \
  --depth 2 --name flow-builder

# Lightning Web Components
node "$PLUGIN_ROOT/dist/cli.js" crawl \
  "https://help.salesforce.com/s/articleView?id=sf.lwc_get_started.htm&type=5" \
  --depth 2 --name lwc
```

### Step 2: Search Your Docs

Once crawled, you can search across all ingested documentation:

```bash
node "$PLUGIN_ROOT/dist/cli.js" search "buyer group entitlement policies"
```

This returns the top 5 results with relevance scores, text snippets, source URLs, and local file paths.

### Step 3: Generate an SME (Optional)

Turn your crawled docs into a specialized Claude Code skill or agent:

```bash
# Generate a skill (for inline Q&A in your session)
node "$PLUGIN_ROOT/dist/cli.js" generate skill commerce-cloud

# Generate an agent (for autonomous research tasks)
node "$PLUGIN_ROOT/dist/cli.js" generate agent commerce-cloud
```

The generated skill includes a topic tree and key concept definitions extracted from the crawled articles, giving Claude immediate domain fluency without needing to search for basics.

## Commands Reference

All commands are run via the sf-docs CLI. Replace `$PLUGIN_ROOT` with your plugin installation path (the hook provides this automatically during sessions).

### search

```bash
node "$PLUGIN_ROOT/dist/cli.js" search "your query here"
```

Semantic search across all ingested docs. Returns top 5 results with relevance scores, snippets (max 500 chars), URLs, and file paths. Use the Read tool on the file path for full article content.

**Options:**
- `-n, --top <number>` — Number of results (default: 5)

### fetch

```bash
node "$PLUGIN_ROOT/dist/cli.js" fetch "https://help.salesforce.com/s/articleView?id=<id>&type=5"
```

Fetch and ingest a single Salesforce Help page. The page is rendered via headless browser (required because SF docs are JS-rendered), converted to markdown, and indexed for search.

**Options:**
- `--if-stale` — Only fetch if the stored copy is older than 30 days

### crawl

```bash
node "$PLUGIN_ROOT/dist/cli.js" crawl <url> [options]
```

Crawl a documentation tree starting from the given URL. Follows article links up to the specified depth.

**Options:**
- `-d, --depth <number>` — Crawl depth (default: 2)
- `--no-scope` — Follow links outside the starting area
- `--force` — Re-fetch even if pages are fresh (< 30 days old)
- `-n, --name <name>` — Register this crawl for future updates

### update

```bash
node "$PLUGIN_ROOT/dist/cli.js" update <crawl-name>    # Re-crawl one
node "$PLUGIN_ROOT/dist/cli.js" update --all           # Re-crawl all registered
node "$PLUGIN_ROOT/dist/cli.js" update <name> --force  # Force re-fetch all pages
```

Re-crawl a registered crawl using its stored settings (URL, depth, scope). Articles fetched within the last 30 days are skipped unless `--force` is used.

### crawls

```bash
node "$PLUGIN_ROOT/dist/cli.js" crawls
```

List all registered crawls with their settings: name, area, depth, article count, last crawled date, and start URL.

### generate

```bash
node "$PLUGIN_ROOT/dist/cli.js" generate skill <crawl-name>  # SKILL.md for inline Q&A
node "$PLUGIN_ROOT/dist/cli.js" generate agent <crawl-name>  # Agent definition for research
```

Generate a domain-specific SME skill or agent from crawled documentation.

**Options:**
- `-o, --output <path>` — Custom output path (default: `data/generated/<crawl-name>/`)

**What gets generated:**
- **Skill** — A `SKILL.md` with YAML frontmatter, identity prompt, search instructions, and a reference summary (topic tree + key concepts, ~4000 tokens)
- **Agent** — An `agent.md` (system prompt with ~8000 token reference summary, workflow instructions, constraints) and `tools.md` (CLI command reference)

### list

```bash
node "$PLUGIN_ROOT/dist/cli.js" list [area]
```

List all ingested documents, optionally filtered by area (e.g., `commerce`, `sf`, `apex`).

### status

```bash
node "$PLUGIN_ROOT/dist/cli.js" status
```

Show index and store statistics: total documents, areas, and indexed chunks.

### remove

```bash
node "$PLUGIN_ROOT/dist/cli.js" remove <article-id>
```

Remove a specific article from the store and vector index.

### rebuild-index

```bash
node "$PLUGIN_ROOT/dist/cli.js" rebuild-index
```

Rebuild the entire vector index from all stored markdown files. Use if the index becomes corrupted or after manual edits to stored articles.

## Auto-Injection Hook

The plugin includes a `PreToolUse` hook that automatically detects when you're working on a Salesforce project and injects the appropriate skill.

### What Triggers It

The hook fires when Claude Code uses the Read, Edit, Write, or Bash tools. It checks:

**File paths** matching:
- `force-app/` (SFDX project structure)
- `.cls`, `.trigger`, `.page`, `.component`, `.cmp` (Salesforce metadata)
- `.apex`, `.soql` (Salesforce query/code files)
- `sfdx-project.json`, `sf-project.json` (project config files)

**Bash commands** matching:
- `sf` or `sfdx` CLI commands (e.g., `sf org list`, `sf deploy`, `sf apex run`)

### What Gets Injected

1. If you have a **generated SME skill** for the detected area (e.g., `sf-commerce-cloud`), that specialized skill is injected
2. Otherwise, the **base `sf-docs` skill** is injected with general search instructions
3. The plugin root path is included so the skill knows where to find the CLI

### Session Deduplication

Each skill is injected only once per session. The hook tracks injected skills via a temp file keyed by your session ID, so you won't see repeated injections.

## Generating SME Skills and Agents

### Skills vs. Agents

| | Skill | Agent |
|---|---|---|
| **Use case** | Quick Q&A within your session | Deep autonomous research |
| **Invocation** | Inline — Claude uses it naturally | Via the Agent tool for dedicated tasks |
| **Reference summary** | ~4000 tokens (compact) | ~8000 tokens (detailed) |
| **Best for** | "What is X?", "How do I configure Y?" | "Research how to implement split shipping and draft a design" |

### How the Reference Summary Works

The generator extracts knowledge from your crawled docs without any LLM calls:

1. **Topic tree** — All H1/H2/H3 headings from every article, organized hierarchically
2. **Key concepts** — The first paragraph under each H2 heading, deduplicated by term
3. **Token budget** — The summary is truncated to fit the token cap (4000 for skills, 8000 for agents)

This gives the generated skill/agent immediate domain fluency — it knows what "entitlement policies" and "buyer groups" mean without needing to search.

## Updating Documentation

Salesforce releases three major updates per year (Spring, Summer, Winter). Use the update command to keep your docs current:

```bash
# See what crawls you have registered
node "$PLUGIN_ROOT/dist/cli.js" crawls

# Update a specific crawl
node "$PLUGIN_ROOT/dist/cli.js" update commerce-cloud

# Update everything
node "$PLUGIN_ROOT/dist/cli.js" update --all

# Force re-fetch all pages (ignores 30-day freshness check)
node "$PLUGIN_ROOT/dist/cli.js" update --all --force
```

After updating, regenerate your SME skills and agents to pick up new content:

```bash
node "$PLUGIN_ROOT/dist/cli.js" generate skill commerce-cloud
node "$PLUGIN_ROOT/dist/cli.js" generate agent commerce-cloud
```

## Plugin Structure

```
claude-plugin-sf-docs/
├── .claude-plugin/plugin.json   # Plugin metadata
├── skills/sf-docs/SKILL.md      # Base skill (search/crawl instructions)
├── hooks/
│   ├── hooks.json               # Hook configuration
│   └── pretooluse-sf-inject.mjs # Auto-detection + skill injection
├── agents/sf-docs-researcher.md # Generic SF docs research agent
├── src/                         # TypeScript CLI source (12 files)
├── tests/                       # Test suite (7 suites, 45 tests)
├── data/
│   ├── _crawls.json             # Crawl registry (tracked in git)
│   ├── generated/               # Generated SME skills + agents (tracked)
│   ├── docs/                    # Crawled markdown articles (local only)
│   └── index/                   # Vector search index (local only)
└── dist/                        # Compiled JS (built during install)
```

**What's tracked in git:** Plugin code, skills, hooks, agents, crawl registry, and generated SMEs.

**What's local only:** Crawled article content (`data/docs/`) and the vector index (`data/index/`). These are created when you run `crawl` commands.

## Troubleshooting

### "Command not found" or CLI path issues

The CLI lives at `$PLUGIN_ROOT/dist/cli.js`. To find your plugin root:

```bash
find ~/.claude/plugins/cache -path "*/sf-docs/dist/cli.js" 2>/dev/null
```

If nothing is found, the plugin may need to be rebuilt:

```bash
PLUGIN_ROOT=$(dirname "$(find ~/.claude/plugins/cache -path '*/sf-docs/package.json' 2>/dev/null | head -1)")
cd "$PLUGIN_ROOT" && npm run setup
```

### First search is slow

The first search downloads the embedding model (`all-MiniLM-L6-v2`, ~22MB). Subsequent searches use the cached model and are fast.

### Crawl seems stuck

Crawling uses a headless browser with a 1.5-second delay between pages to avoid rate limiting. A depth-3 crawl of a large doc area (400+ articles) takes 15-30 minutes. Check the console output — it logs every page fetched.

### Pages are skipped during crawl

By default, pages fetched within the last 30 days are skipped. Use `--force` to re-fetch everything:

```bash
node "$PLUGIN_ROOT/dist/cli.js" update commerce-cloud --force
```

### Hook isn't firing

The hook only triggers on Salesforce-related files and commands. It detects `.cls`, `.trigger`, `force-app/`, `sfdx-project.json`, and `sf`/`sfdx` CLI commands. If you're working on Salesforce files with different extensions, the hook won't trigger — use the sf-docs skill manually via `/sf-docs`.

### Vector index seems corrupted

Rebuild it from the stored markdown files:

```bash
node "$PLUGIN_ROOT/dist/cli.js" rebuild-index
```

## Technical Details

- **Embeddings:** `all-MiniLM-L6-v2` via `@huggingface/transformers` — runs locally, no API keys
- **Vector DB:** Vectra (file-based JSON index) — no server process needed
- **Browser:** Playwright Chromium (headless) — required because SF docs are JS-rendered
- **Tokenizer:** `cl100k_base` via `js-tiktoken` — used for chunk sizing and summary budgets
- **Staleness:** Articles older than 30 days are considered stale and re-fetched on crawl/update

## License

MIT
