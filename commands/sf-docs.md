---
description: "Run sf-docs CLI commands — search, fetch, crawl, update, generate, list, status, crawls, remove, rebuild-index"
---

# SF Docs CLI

Run the sf-docs CLI with the provided arguments.

## Plugin Root

Determine the plugin root to locate the CLI:

```bash
PLUGIN_ROOT=$(dirname "$(dirname "$(find ~/.claude/plugins/cache -path "*/sf-docs/commands/sf-docs.md" 2>/dev/null | head -1)")")
```

## Execution

Run the user's arguments as a CLI command:

```bash
node "$PLUGIN_ROOT/dist/cli.js" <arguments>
```

Pass all arguments after `/sf-docs` directly to the CLI. For example:

| User types | You run |
|---|---|
| `/sf-docs search "checkout"` | `node "$PLUGIN_ROOT/dist/cli.js" search "checkout"` |
| `/sf-docs crawl <url> --depth 2 --name my-docs` | `node "$PLUGIN_ROOT/dist/cli.js" crawl <url> --depth 2 --name my-docs` |
| `/sf-docs generate skill commerce-cloud` | `node "$PLUGIN_ROOT/dist/cli.js" generate skill commerce-cloud` |
| `/sf-docs update --all` | `node "$PLUGIN_ROOT/dist/cli.js" update --all` |
| `/sf-docs crawls` | `node "$PLUGIN_ROOT/dist/cli.js" crawls` |
| `/sf-docs status` | `node "$PLUGIN_ROOT/dist/cli.js" status` |
| `/sf-docs list commerce` | `node "$PLUGIN_ROOT/dist/cli.js" list commerce` |

## Pre-flight

Before running, verify the CLI is built:

```bash
test -f "$PLUGIN_ROOT/dist/cli.js" || (cd "$PLUGIN_ROOT" && npm run setup)
```

## No Arguments

If the user runs `/sf-docs` with no arguments, show available commands:

```bash
node "$PLUGIN_ROOT/dist/cli.js" --help
```
