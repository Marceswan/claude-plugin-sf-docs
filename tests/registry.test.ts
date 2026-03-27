import { Registry, CrawlEntry } from '../src/registry.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Registry', () => {
  let registry: Registry;
  let registryPath: string;

  beforeEach(() => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'sf-docs-registry-'));
    registryPath = join(tmpDir, '_crawls.json');
    registry = new Registry(registryPath);
  });

  afterEach(() => {
    const dir = registryPath.replace('/_crawls.json', '');
    rmSync(dir, { recursive: true, force: true });
  });

  const sampleEntry: CrawlEntry = {
    name: 'commerce-cloud',
    startUrl: 'https://help.salesforce.com/s/articleView?id=commerce.comm_intro.htm&type=5',
    depth: 3,
    scope: true,
    area: 'commerce',
    createdAt: '2026-03-26',
    lastCrawledAt: '2026-03-26',
    articleCount: 384,
  };

  test('load returns empty object when file does not exist', () => {
    const entries = registry.loadAll();
    expect(entries).toEqual({});
  });

  test('add saves entry and persists to disk', () => {
    registry.add(sampleEntry);
    expect(existsSync(registryPath)).toBe(true);
    const raw = JSON.parse(readFileSync(registryPath, 'utf-8'));
    expect(raw['commerce-cloud']).toBeDefined();
    expect(raw['commerce-cloud'].depth).toBe(3);
  });

  test('get returns entry by name', () => {
    registry.add(sampleEntry);
    const entry = registry.get('commerce-cloud');
    expect(entry).not.toBeNull();
    expect(entry!.startUrl).toContain('commerce.comm_intro');
  });

  test('get returns null for unknown name', () => {
    expect(registry.get('nonexistent')).toBeNull();
  });

  test('update merges fields into existing entry', () => {
    registry.add(sampleEntry);
    registry.update('commerce-cloud', { lastCrawledAt: '2026-04-01', articleCount: 400 });
    const entry = registry.get('commerce-cloud');
    expect(entry!.lastCrawledAt).toBe('2026-04-01');
    expect(entry!.articleCount).toBe(400);
    expect(entry!.depth).toBe(3); // unchanged
  });

  test('list returns all entries as array', () => {
    registry.add(sampleEntry);
    registry.add({ ...sampleEntry, name: 'apex-docs', area: 'apex', depth: 2 });
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map(e => e.name).sort()).toEqual(['apex-docs', 'commerce-cloud']);
  });

  test('remove deletes entry by name', () => {
    registry.add(sampleEntry);
    registry.remove('commerce-cloud');
    expect(registry.get('commerce-cloud')).toBeNull();
    expect(registry.list()).toHaveLength(0);
  });

  test('remove is no-op for unknown name', () => {
    registry.remove('nonexistent'); // should not throw
  });
});
