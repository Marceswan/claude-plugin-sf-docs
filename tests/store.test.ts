// tests/store.test.ts
import { Store, Article } from '../src/store.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Store', () => {
  let store: Store;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sf-docs-test-'));
    store = new Store(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleArticle: Article = {
    id: 'commerce.comm_pas',
    title: 'Payment Acquirer Setup',
    url: 'https://help.salesforce.com/s/articleView?id=commerce.comm_pas.htm&type=5',
    area: 'commerce',
    content: '# Payment Acquirer Setup\n\nConfigure your payment gateway...',
    fetchedAt: new Date('2026-03-26'),
  };

  test('write creates markdown file with frontmatter', () => {
    store.write(sampleArticle);
    const filePath = join(tmpDir, 'commerce', 'commerce.comm_pas.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('title: "Payment Acquirer Setup"');
    expect(content).toContain('url: "https://help.salesforce.com');
    expect(content).toContain('area: "commerce"');
    expect(content).toContain('# Payment Acquirer Setup');
  });

  test('read returns stored article', () => {
    store.write(sampleArticle);
    const result = store.read('commerce.comm_pas');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Payment Acquirer Setup');
    expect(result!.content).toContain('Configure your payment gateway');
  });

  test('read returns null for missing article', () => {
    expect(store.read('nonexistent.article')).toBeNull();
  });

  test('exists returns false for missing article', () => {
    expect(store.exists('nonexistent.article')).toBe(false);
  });

  test('exists returns true for stored article', () => {
    store.write(sampleArticle);
    expect(store.exists('commerce.comm_pas')).toBe(true);
  });

  test('isStale returns true for missing article', () => {
    expect(store.isStale('nonexistent.article')).toBe(true);
  });

  test('isStale returns false for recently fetched article', () => {
    store.write(sampleArticle);
    expect(store.isStale('commerce.comm_pas', 30)).toBe(false);
  });

  test('isStale returns true for old article', () => {
    const oldArticle = { ...sampleArticle, fetchedAt: new Date('2025-01-01') };
    store.write(oldArticle);
    expect(store.isStale('commerce.comm_pas', 30)).toBe(true);
  });

  test('list returns all articles in an area', () => {
    store.write(sampleArticle);
    store.write({ ...sampleArticle, id: 'commerce.comm_gw', title: 'Gateway Config' });
    const articles = store.list('commerce');
    expect(articles).toHaveLength(2);
  });

  test('list without area returns all articles', () => {
    store.write(sampleArticle);
    store.write({ ...sampleArticle, id: 'apex.apex_ref', area: 'apex', title: 'Apex Ref' });
    const articles = store.list();
    expect(articles).toHaveLength(2);
  });

  test('writeManifest creates _manifest.json', () => {
    const entries = [{ id: 'commerce.comm_pas', title: 'Payment Acquirer Setup', url: sampleArticle.url, fetchedAt: '2026-03-26' }];
    store.writeManifest('commerce', entries);
    const manifestPath = join(tmpDir, 'commerce', '_manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest).toHaveLength(1);
    expect(manifest[0].id).toBe('commerce.comm_pas');
  });
});
