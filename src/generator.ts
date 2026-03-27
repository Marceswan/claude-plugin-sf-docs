import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { Registry, CrawlEntry } from './registry.js';
import { Store } from './store.js';
import { Summarizer } from './summarizer.js';

const SKILL_MAX_TOKENS = 4000;
const AGENT_MAX_TOKENS = 8000;

export class Generator {
  private summarizer = new Summarizer();

  constructor(
    private readonly registry: Registry,
    private readonly store: Store,
    private readonly outputDir: string,
  ) {}

  private getEntry(crawlName: string): CrawlEntry {
    const entry = this.registry.get(crawlName);
    if (!entry) throw new Error(`No registered crawl named "${crawlName}"`);
    return entry;
  }

  private getDocsForArea(area: string): Array<{ id: string; title: string; content: string }> {
    const articles = this.store.getAll().filter(a => a.area === area);
    return articles.map(a => ({ id: a.id, title: a.title, content: a.content }));
  }

  private titleCase(name: string): string {
    return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  generateSkill(crawlName: string, outputPath?: string): string {
    const entry = this.getEntry(crawlName);
    const docs = this.getDocsForArea(entry.area);
    const summary = this.summarizer.generateSummary(docs, SKILL_MAX_TOKENS);
    const displayName = this.titleCase(crawlName);

    const content = `---
name: sf-${crawlName}
description: SME for ${entry.area} — search and answer questions using local SF documentation
---

# SF ${displayName} Expert

## Identity

You are a Salesforce ${displayName} subject matter expert. You have deep knowledge of ${entry.area} features, configuration, and best practices. You answer questions using the locally ingested Salesforce documentation.

## Plugin Root

Determine the plugin root (needed for CLI commands below):

\`\`\`bash
PLUGIN_ROOT=$(dirname "$(dirname "$(find ~/.claude/plugins/cache -path "*/sf-docs/skills/sf-docs/SKILL.md" 2>/dev/null | head -1)")")
\`\`\`

If this skill was injected by the sf-docs hook, the plugin root path is provided in the injection context.

## How to Answer Questions

1. Search local docs first: \`node "$PLUGIN_ROOT/dist/cli.js" search "<query>"\`
2. Read the most relevant result file for full detail using the Read tool
3. Cite the source article URL in your answer
4. If the docs don't cover the question, say so explicitly — do not guess

## Reference Summary

${summary}
`;

    const filePath = outputPath ?? join(this.outputDir, crawlName, 'SKILL.md');
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  generateAgent(crawlName: string, outputPath?: string): string {
    const entry = this.getEntry(crawlName);
    const docs = this.getDocsForArea(entry.area);
    const summary = this.summarizer.generateSummary(docs, AGENT_MAX_TOKENS);
    const displayName = this.titleCase(crawlName);

    const agentDir = outputPath ?? join(this.outputDir, crawlName, 'agent');
    mkdirSync(agentDir, { recursive: true });

    const agentContent = `# SF ${displayName} Agent

## Role

You are an autonomous Salesforce ${displayName} specialist. You research questions, trace configurations, and draft recommendations using official Salesforce documentation stored locally.

## Domain Knowledge

${summary}

## Plugin Root

Determine the plugin root (needed for CLI commands below):

\`\`\`bash
PLUGIN_ROOT=$(dirname "$(dirname "$(find ~/.claude/plugins/cache -path "*/sf-docs/skills/sf-docs/SKILL.md" 2>/dev/null | head -1)")")
\`\`\`

If this agent was invoked via the sf-docs hook, the plugin root path is provided in the injection context.

## Workflow

1. Understand the user's question and identify which ${entry.area} topics are relevant
2. Search local docs: \`node "$PLUGIN_ROOT/dist/cli.js" search "<query>"\`
3. Read the most relevant doc files for full detail using the Read tool
4. Cross-reference multiple articles when the question spans topics
5. Synthesize a comprehensive answer with citations (include article URLs)

## Constraints

- Only cite information found in the local doc corpus
- When docs are insufficient, state what is missing and what topics need additional documentation
- Recommend fetching additional docs via \`node "$PLUGIN_ROOT/dist/cli.js" fetch <url>\` when gaps exist
- Do not guess or fabricate configuration steps — if the docs don't cover it, say so
`;

    const toolsContent = `# Available Tools

The following sf-docs CLI commands are available for researching Salesforce ${displayName} documentation:

## Search

\`\`\`bash
node "$PLUGIN_ROOT/dist/cli.js" search "<query>"
\`\`\`

Semantic search across all ingested ${entry.area} docs. Returns top 5 results with relevance scores, snippets, URLs, and file paths.

## Fetch

\`\`\`bash
node "$PLUGIN_ROOT/dist/cli.js" fetch "<url>"
\`\`\`

Fetch and ingest a single Salesforce doc page. Use when you find a referenced article that isn't in the local corpus.

## List

\`\`\`bash
node "$PLUGIN_ROOT/dist/cli.js" list ${entry.area}
\`\`\`

List all ingested documents in the ${entry.area} area.

## Status

\`\`\`bash
node "$PLUGIN_ROOT/dist/cli.js" status
\`\`\`

Show index and store statistics.
`;

    writeFileSync(join(agentDir, 'agent.md'), agentContent, 'utf-8');
    writeFileSync(join(agentDir, 'tools.md'), toolsContent, 'utf-8');
    return agentDir;
  }
}
