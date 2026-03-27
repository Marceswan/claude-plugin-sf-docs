// src/store.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

export interface Article {
  id: string;
  title: string;
  url: string;
  area: string;
  content: string;
  fetchedAt: Date;
}

export interface ManifestEntry {
  id: string;
  title: string;
  url: string;
  fetchedAt: string;
}

export class Store {
  constructor(private readonly basePath: string) {}

  private filePath(article: { id: string; area: string }): string {
    return join(this.basePath, article.area, `${article.id}.md`);
  }

  private areaFromId(id: string): string {
    const dotIndex = id.indexOf('.');
    return dotIndex > 0 ? id.substring(0, dotIndex) : 'general';
  }

  write(article: Article): void {
    const path = this.filePath(article);
    mkdirSync(dirname(path), { recursive: true });
    const frontmatter = [
      '---',
      `title: "${article.title}"`,
      `url: "${article.url}"`,
      `area: "${article.area}"`,
      `fetched: "${article.fetchedAt.toISOString().split('T')[0]}"`,
      '---',
    ].join('\n');
    writeFileSync(path, `${frontmatter}\n\n${article.content}`, 'utf-8');
  }

  read(articleId: string): Article | null {
    const area = this.areaFromId(articleId);
    const path = join(this.basePath, area, `${articleId}.md`);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    return this.parseMarkdown(articleId, area, raw);
  }

  exists(articleId: string): boolean {
    const area = this.areaFromId(articleId);
    const path = join(this.basePath, area, `${articleId}.md`);
    return existsSync(path);
  }

  isStale(articleId: string, maxAgeDays: number = 30): boolean {
    const article = this.read(articleId);
    if (!article) return true;
    const ageMs = Date.now() - article.fetchedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > maxAgeDays;
  }

  delete(articleId: string): boolean {
    const area = this.areaFromId(articleId);
    const path = join(this.basePath, area, `${articleId}.md`);
    if (!existsSync(path)) return false;
    unlinkSync(path);
    return true;
  }

  list(area?: string): Array<{ id: string; title: string; url: string; area: string; fetchedAt: Date }> {
    const results: Array<{ id: string; title: string; url: string; area: string; fetchedAt: Date }> = [];
    const areas = area ? [area] : this.listAreas();

    for (const a of areas) {
      const areaPath = join(this.basePath, a);
      if (!existsSync(areaPath)) continue;
      const files = readdirSync(areaPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const articleId = file.replace('.md', '');
        const article = this.read(articleId);
        if (article) {
          results.push({ id: article.id, title: article.title, url: article.url, area: article.area, fetchedAt: article.fetchedAt });
        }
      }
    }
    return results;
  }

  getAll(): Article[] {
    const results: Article[] = [];
    for (const entry of this.list()) {
      const article = this.read(entry.id);
      if (article) results.push(article);
    }
    return results;
  }

  writeManifest(area: string, entries: ManifestEntry[]): void {
    const dir = join(this.basePath, area);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '_manifest.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  private listAreas(): string[] {
    if (!existsSync(this.basePath)) return [];
    return readdirSync(this.basePath).filter(f => {
      const fullPath = join(this.basePath, f);
      return statSync(fullPath).isDirectory();
    });
  }

  private parseMarkdown(id: string, area: string, raw: string): Article {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    if (!fmMatch) {
      return { id, title: id, url: '', area, content: raw, fetchedAt: new Date() };
    }
    const frontmatter = fmMatch[1];
    const content = fmMatch[2];
    const title = frontmatter.match(/title:\s*"(.*)"/)?.[1] || id;
    const url = frontmatter.match(/url:\s*"(.*)"/)?.[1] || '';
    const fetched = frontmatter.match(/fetched:\s*"(.*)"/)?.[1] || '';
    return { id, title, url, area, content, fetchedAt: fetched ? new Date(fetched) : new Date() };
  }
}
