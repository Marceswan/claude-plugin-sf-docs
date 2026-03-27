#!/usr/bin/env node
// src/cli.ts
import { Command } from 'commander';
import { Fetcher } from './fetcher.js';
import { Parser } from './parser.js';
import { Store } from './store.js';
import { VectorIndex } from './vectorIndex.js';
import { Crawler } from './crawler.js';
import { Registry } from './registry.js';
import { PATHS } from './config.js';
import { Generator } from './generator.js';

const program = new Command();

program
  .name('sf-docs')
  .description('Salesforce documentation ingestion and search tool')
  .version('1.0.0');

program
  .command('fetch <url>')
  .description('Fetch and ingest a single SF doc page')
  .option('--if-stale', 'Only fetch if the stored copy is stale')
  .action(async (url: string, opts: { ifStale?: boolean }) => {
    const parser = new Parser();
    const store = new Store(PATHS.docs);
    const vectorIndex = new VectorIndex();
    const fetcher = new Fetcher();

    const articleId = parser.extractArticleId(url);
    if (opts.ifStale && !store.isStale(articleId)) {
      console.log(`Article ${articleId} is fresh (not stale). Skipping.`);
      return;
    }

    console.log(`Fetching: ${url}`);
    try {
      const raw = await fetcher.fetchWithRetry(url);
      const article = parser.buildArticle(raw);
      store.write(article);
      const chunks = await vectorIndex.addDocument(article);
      console.log(`Stored: ${article.title} (${article.area}/${article.id})`);
      console.log(`Indexed: ${chunks} chunks`);
    } finally {
      await fetcher.close();
    }
  });

program
  .command('crawl <url>')
  .description('Crawl a doc tree starting from the given URL')
  .option('-d, --depth <number>', 'Crawl depth', '2')
  .option('--no-scope', 'Follow links outside the starting area')
  .option('--force', 'Re-fetch even if pages are fresh')
  .option('-n, --name <name>', 'Register this crawl for future updates')
  .action(async (url: string, opts: { depth: string; scope: boolean; force: boolean; name?: string }) => {
    const crawler = new Crawler();
    console.log(`Crawling from: ${url} (depth: ${opts.depth}, scope: ${opts.scope ? 'on' : 'off'})`);
    const result = await crawler.crawl(url, {
      depth: parseInt(opts.depth, 10),
      noScope: !opts.scope,
      force: opts.force || false,
    });
    console.log(`\nDone. Fetched: ${result.fetched}, Skipped: ${result.skipped}`);

    if (opts.name) {
      const registry = new Registry(PATHS.crawls);
      const parser = new Parser();
      const articleId = parser.extractArticleId(url);
      const area = parser.extractArea(articleId);
      const today = new Date().toISOString().split('T')[0];
      const existing = registry.get(opts.name);

      if (existing) {
        registry.update(opts.name, {
          lastCrawledAt: today,
          articleCount: result.articleCount,
          depth: parseInt(opts.depth, 10),
          startUrl: url,
          scope: opts.scope,
        });
        console.log(`Updated registry entry: ${opts.name}`);
      } else {
        registry.add({
          name: opts.name,
          startUrl: url,
          depth: parseInt(opts.depth, 10),
          scope: opts.scope,
          area,
          createdAt: today,
          lastCrawledAt: today,
          articleCount: result.articleCount,
        });
        console.log(`Registered crawl: ${opts.name}`);
      }
    }
  });

program
  .command('search <query...>')
  .description('Semantic search across ingested docs')
  .option('-n, --top <number>', 'Number of results', '5')
  .action(async (queryParts: string[], opts: { top: string }) => {
    const query = queryParts.join(' ');
    const vectorIndex = new VectorIndex();
    const results = await vectorIndex.search(query, parseInt(opts.top, 10));

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    for (const r of results) {
      const truncatedText = r.text.length > 500 ? r.text.substring(0, 500) + '...' : r.text;
      console.log(`\nScore: ${r.score.toFixed(2)} | ${r.metadata.area} > ${r.metadata.title}`);
      console.log(`"${truncatedText}"`);
      console.log(`URL: ${r.metadata.url}`);
      console.log(`File: ${PATHS.docs}/${r.metadata.area}/${r.metadata.articleId}.md`);
    }
  });

program
  .command('list [area]')
  .description('List ingested documents')
  .action((area?: string) => {
    const store = new Store(PATHS.docs);
    const articles = store.list(area);

    if (articles.length === 0) {
      console.log(area ? `No documents in area: ${area}` : 'No documents ingested yet.');
      return;
    }

    console.log(`${articles.length} document(s):\n`);
    for (const a of articles) {
      console.log(`  ${a.area}/${a.id} - ${a.title} (fetched: ${a.fetchedAt.toISOString().split('T')[0]})`);
    }
  });

program
  .command('status')
  .description('Show index and store statistics')
  .action(async () => {
    const store = new Store(PATHS.docs);

    const articles = store.list();
    const areas = [...new Set(articles.map(a => a.area))];

    console.log('SF Docs Status:');
    console.log(`  Documents: ${articles.length}`);
    console.log(`  Areas: ${areas.join(', ') || '(none)'}`);

    try {
      const vectorIndex = new VectorIndex();
      const indexStats = await vectorIndex.stats();
      console.log(`  Index chunks: ${indexStats.itemCount}`);
    } catch {
      console.log(`  Index: unavailable (no API key configured)`);
    }
  });

program
  .command('remove <articleId>')
  .description('Remove a document from store and index')
  .action(async (articleId: string) => {
    const store = new Store(PATHS.docs);
    const vectorIndex = new VectorIndex();

    if (!store.exists(articleId)) {
      console.log(`Article ${articleId} not found in store.`);
      return;
    }

    await vectorIndex.remove(articleId);
    store.delete(articleId);
    console.log(`Removed ${articleId} from store and vector index.`);
  });

program
  .command('rebuild-index')
  .description('Rebuild the vector index from all stored markdown files')
  .action(async () => {
    const store = new Store(PATHS.docs);
    const vectorIndex = new VectorIndex();

    const articles = store.getAll();
    console.log(`Rebuilding index from ${articles.length} documents...`);
    const result = await vectorIndex.rebuild(articles);
    console.log(`Done. Total chunks: ${result.totalChunks}`);
  });

program
  .command('crawls')
  .description('List all registered crawls')
  .action(() => {
    const registry = new Registry(PATHS.crawls);
    const entries = registry.list();

    if (entries.length === 0) {
      console.log('No registered crawls. Use `sf-docs crawl <url> --name <name>` to register one.');
      return;
    }

    console.log(`${entries.length} registered crawl(s):\n`);
    console.log('  Name                Area         Depth  Articles  Last Crawled  Start URL');
    console.log('  ' + '-'.repeat(95));
    for (const e of entries) {
      const name = e.name.padEnd(20);
      const area = e.area.padEnd(13);
      const depth = String(e.depth).padEnd(7);
      const articles = String(e.articleCount).padEnd(10);
      const lastCrawled = e.lastCrawledAt.padEnd(14);
      console.log(`  ${name}${area}${depth}${articles}${lastCrawled}${e.startUrl}`);
    }
  });

program
  .command('update [crawl-name]')
  .description('Re-crawl a registered crawl using its stored settings')
  .option('--all', 'Re-crawl all registered crawls')
  .option('--force', 'Re-fetch even if pages are fresh')
  .action(async (crawlName: string | undefined, opts: { all?: boolean; force?: boolean }) => {
    const registry = new Registry(PATHS.crawls);

    if (!crawlName && !opts.all) {
      console.log('Usage: sf-docs update <crawl-name> or sf-docs update --all');
      console.log('Run `sf-docs crawls` to see registered crawls.');
      return;
    }

    const entries = opts.all ? registry.list() : [];
    if (crawlName && !opts.all) {
      const entry = registry.get(crawlName);
      if (!entry) {
        console.log(`No registered crawl named "${crawlName}".`);
        console.log('Run `sf-docs crawls` to see available crawls.');
        return;
      }
      entries.push(entry);
    }

    if (entries.length === 0) {
      console.log('No registered crawls to update.');
      return;
    }

    for (const entry of entries) {
      console.log(`\nUpdating: ${entry.name} (${entry.startUrl}, depth: ${entry.depth})`);
      const crawler = new Crawler();
      const result = await crawler.crawl(entry.startUrl, {
        depth: entry.depth,
        noScope: !entry.scope,
        force: opts.force || false,
      });
      const today = new Date().toISOString().split('T')[0];
      registry.update(entry.name, { lastCrawledAt: today, articleCount: result.articleCount });
      console.log(`Done. Fetched: ${result.fetched}, Skipped: ${result.skipped}, Total articles: ${result.articleCount}`);
    }
  });

const generate = program
  .command('generate')
  .description('Generate SME skills or agent definitions from crawled docs');

generate
  .command('skill <crawl-name>')
  .description('Generate a SKILL.md for domain Q&A')
  .option('-o, --output <path>', 'Custom output path for SKILL.md')
  .action((crawlName: string, opts: { output?: string }) => {
    const registry = new Registry(PATHS.crawls);
    const store = new Store(PATHS.docs);
    const generator = new Generator(registry, store, PATHS.generated);

    try {
      const path = generator.generateSkill(crawlName, opts.output);
      console.log(`Skill generated: ${path}`);
    } catch (err) {
      console.error((err as Error).message);
      console.log('Run `sf-docs crawls` to see available crawls.');
    }
  });

generate
  .command('agent <crawl-name>')
  .description('Generate an agent definition for autonomous research')
  .option('-o, --output <path>', 'Custom output directory')
  .action((crawlName: string, opts: { output?: string }) => {
    const registry = new Registry(PATHS.crawls);
    const store = new Store(PATHS.docs);
    const generator = new Generator(registry, store, PATHS.generated);

    try {
      const dir = generator.generateAgent(crawlName, opts.output);
      console.log(`Agent generated: ${dir}/`);
      console.log(`  - ${dir}/agent.md (system prompt)`);
      console.log(`  - ${dir}/tools.md (tool reference)`);
    } catch (err) {
      console.error((err as Error).message);
      console.log('Run `sf-docs crawls` to see available crawls.');
    }
  });

program.parse();

