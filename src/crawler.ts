import { Fetcher } from './fetcher.js';
import { Parser } from './parser.js';
import { Store } from './store.js';
import { VectorIndex } from './vectorIndex.js';
import { PATHS } from './config.js';

export function extractArticleLinks(html: string, baseUrl: string): string[] {
  const regex = /href=["']([^"']*\/s\/articleView\?id=[^"'&]+[^"']*)["']/gi;
  const links = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) {
      href = `${baseUrl}${href}`;
    }
    const url = new URL(href);
    const id = url.searchParams.get('id');
    if (id) {
      links.add(`${url.origin}/s/articleView?id=${id}&type=5`);
    }
  }

  return Array.from(links);
}

export function isInScope(articleId: string, scopeArea: string): boolean {
  const dotIndex = articleId.indexOf('.');
  const area = dotIndex > 0 ? articleId.substring(0, dotIndex) : 'general';
  return area === scopeArea;
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
            const links = extractArticleLinks(raw.html, 'https://help.salesforce.com');
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
