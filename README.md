# sf-docs — Claude Code Plugin

Salesforce documentation ingestion, semantic search, and SME agent generation.

## Installation

```bash
claude plugin add github:Marceswan/claude-plugin-sf-docs
```

## Features

- **Search** — Semantic search across ingested Salesforce documentation
- **Crawl** — Bulk ingest SF Help articles with depth-controlled link following
- **Update** — Re-crawl registered doc sets to keep current with new releases
- **Generate** — Create domain-specific SME skills and agent definitions from crawled docs
- **Auto-inject** — PreToolUse hook detects Salesforce projects and injects relevant skills

## Quick Start

```bash
# Crawl Commerce Cloud docs and register for updates
sf-docs crawl "https://help.salesforce.com/s/articleView?id=commerce.comm_intro.htm&type=5" --depth 3 --name commerce-cloud

# Generate an SME skill and agent
sf-docs generate skill commerce-cloud
sf-docs generate agent commerce-cloud

# Search across ingested docs
sf-docs search "checkout configuration"

# Update all registered crawls
sf-docs update --all
```

## How It Works

When you work on Salesforce files (`.cls`, `.trigger`, `force-app/`, etc.), the plugin automatically injects the sf-docs skill into your session. If you have generated SME skills for specific areas (e.g., Commerce Cloud), it injects the specialized skill instead.

## Requirements

- Node.js 18+
- Playwright Chromium (auto-installed)
