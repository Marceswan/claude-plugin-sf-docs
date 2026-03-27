import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface CrawlEntry {
  name: string;
  startUrl: string;
  depth: number;
  scope: boolean;
  area: string;
  createdAt: string;
  lastCrawledAt: string;
  articleCount: number;
}

export class Registry {
  constructor(private readonly filePath: string) {}

  loadAll(): Record<string, CrawlEntry> {
    if (!existsSync(this.filePath)) return {};
    const raw = readFileSync(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  private save(data: Record<string, CrawlEntry>): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  get(name: string): CrawlEntry | null {
    const all = this.loadAll();
    return all[name] ?? null;
  }

  add(entry: CrawlEntry): void {
    const all = this.loadAll();
    all[entry.name] = entry;
    this.save(all);
  }

  update(name: string, fields: Partial<CrawlEntry>): void {
    const all = this.loadAll();
    if (!all[name]) return;
    all[name] = { ...all[name], ...fields };
    this.save(all);
  }

  list(): CrawlEntry[] {
    return Object.values(this.loadAll());
  }

  remove(name: string): void {
    const all = this.loadAll();
    delete all[name];
    this.save(all);
  }
}
