import { Fetcher } from './fetcher.js';
import { Parser } from './parser.js';
import { Store } from './store.js';
import { VectorIndex } from './vectorIndex.js';
import { PATHS } from './config.js';

export function extractArticleLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();

  // help.salesforce.com links: /s/articleView?id=...
  const baseOrigin = new URL(baseUrl).origin;
  const helpRegex = /href=["']([^"']*\/s\/articleView\?id=[^"'&]+[^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = helpRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) {
      href = `${baseOrigin}${href}`;
    }
    try {
      const url = new URL(href);
      const id = url.searchParams.get('id');
      if (id) {
        links.add(`${url.origin}/s/articleView?id=${id}&type=5`);
      }
    } catch { /* invalid URL */ }
  }

  // developer.salesforce.com links: /docs/.../*.html
  const devRegex = /href=["']([^"']*developer\.salesforce\.com\/docs\/[^"']+\.html)["']/gi;
  while ((match = devRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('//')) href = `https:${href}`;
    if (!href.startsWith('http')) continue;
    links.add(href);
  }

  // Relative links on developer.salesforce.com pages (e.g., href="/docs/ai/..." or href="page.html")
  if (baseUrl.includes('developer.salesforce.com')) {
    const relRegex = /href=["'](\/docs\/[^"']+\.html|(?!https?:\/\/|\/\/|#|javascript:)[^"']+\.html)["']/gi;
    while ((match = relRegex.exec(html)) !== null) {
      try {
        const resolved = new URL(match[1], baseUrl).href;
        if (resolved.includes('developer.salesforce.com/docs/')) {
          links.add(resolved);
        }
      } catch { /* invalid URL */ }
    }
  }

  return Array.from(links);
}

export function isInScope(articleId: string, scopeArea: string): boolean {
  const dotIndex = articleId.indexOf('.');
  const area = dotIndex > 0 ? articleId.substring(0, dotIndex) : 'general';
  // For developer docs, check if the article starts with the same path prefix
  // e.g., scopeArea="ai" matches articleId="ai.agentforce.guide.agent-script"
  if (area === scopeArea) return true;
  // Also allow if the full ID shares the first two segments with the scope article
  // e.g., "ai.agentforce.guide.X" stays in scope with "ai.agentforce.guide.Y"
  const scopeParts = scopeArea.split('.').slice(0, 2).join('.');
  return articleId.startsWith(scopeParts);
}

export interface CrawlOptions {
  depth: number;
  noScope: boolean;
  force: boolean;
}

export class Crawler {
  private fetcher: Fetcher;
  private parser: Parser;
  private store: Store;
  private vectorIndex: VectorIndex;
  private visited: Set<string> = new Set();

  constructor() {
    this.fetcher = new Fetcher();
    this.parser = new Parser();
    this.store = new Store(PATHS.docs);
    this.vectorIndex = new VectorIndex();
  }

  async crawl(startUrl: string, options: CrawlOptions): Promise<{ fetched: number; skipped: number; articleCount: number }> {
    const startId = this.parser.extractArticleId(startUrl);
    const scopeArea = this.parser.extractArea(startId);

    let currentLevel = [startUrl];
    let fetched = 0;
    let skipped = 0;
    let total = 0;

    for (let depth = 0; depth <= options.depth; depth++) {
      const nextLevel: string[] = [];

      for (const url of currentLevel) {
        const articleId = this.parser.extractArticleId(url);

        if (this.visited.has(articleId)) {
          skipped++;
          continue;
        }
        this.visited.add(articleId);

        if (!options.noScope && !isInScope(articleId, scopeArea)) {
          skipped++;
          continue;
        }

        if (!options.force && !this.store.isStale(articleId)) {
          skipped++;
          console.log(`  [skip] ${articleId} (fresh)`);
          continue;
        }

        total++;
        console.log(`  [${total}] Fetching: ${articleId}...`);

        try {
          const raw = await this.fetcher.fetchWithRetry(url);
          const article = this.parser.buildArticle(raw);

          this.store.write(article);
          const chunkCount = await this.vectorIndex.addDocument(article);
          console.log(`    -> Stored + indexed (${chunkCount} chunks)`);
          fetched++;

          if (depth < options.depth) {
            const links = extractArticleLinks(raw.html, url);
            nextLevel.push(...links);
          }

          await this.fetcher.delay();
        } catch (err) {
          console.error(`    -> FAILED: ${(err as Error).message}`);
        }
      }

      currentLevel = [...new Set(nextLevel)];
    }

    const articles = this.store.list(scopeArea);
    this.store.writeManifest(scopeArea, articles.map(a => ({
      id: a.id,
      title: a.title,
      url: a.url,
      fetchedAt: a.fetchedAt.toISOString().split('T')[0],
    })));

    await this.fetcher.close();
    return { fetched, skipped, articleCount: articles.length };
  }
}
