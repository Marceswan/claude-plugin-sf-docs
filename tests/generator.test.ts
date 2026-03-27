import { Generator } from '../src/generator.js';
import { Registry, CrawlEntry } from '../src/registry.js';
import { Store } from '../src/store.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Generator', () => {
  let tmpDir: string;
  let registryPath: string;
  let registry: Registry;
  let store: Store;
  let outputDir: string;

  const sampleEntry: CrawlEntry = {
    name: 'test-area',
    startUrl: 'https://help.salesforce.com/s/articleView?id=testarea.intro.htm&type=5',
    depth: 2,
    scope: true,
    area: 'testarea',
    createdAt: '2026-03-26',
    lastCrawledAt: '2026-03-26',
    articleCount: 2,
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sf-docs-gen-'));
    registryPath = join(tmpDir, '_crawls.json');
    registry = new Registry(registryPath);
    const docsDir = join(tmpDir, 'docs');
    store = new Store(docsDir);
    outputDir = join(tmpDir, 'generated');

    // Seed registry and docs
    registry.add(sampleEntry);
    store.write({
      id: 'testarea.intro',
      title: 'Introduction to Test Area',
      url: 'https://help.salesforce.com/s/articleView?id=testarea.intro.htm&type=5',
      area: 'testarea',
      content: '# Introduction to Test Area\n\nThis is the intro.\n\n## Key Feature\n\nThe key feature does something important.\n\n## Setup\n\nSetup involves configuration steps.',
      fetchedAt: new Date('2026-03-26'),
    });
    store.write({
      id: 'testarea.config',
      title: 'Configuration Guide',
      url: 'https://help.salesforce.com/s/articleView?id=testarea.config.htm&type=5',
      area: 'testarea',
      content: '# Configuration Guide\n\nHow to configure the system.\n\n## Permissions\n\nSet up the required permission sets.\n\n## Data Model\n\nThe data model uses standard and custom objects.',
      fetchedAt: new Date('2026-03-26'),
    });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('generateSkill creates SKILL.md with expected sections', () => {
    const generator = new Generator(registry, store, outputDir);
    const skillPath = generator.generateSkill('test-area');
    expect(existsSync(skillPath)).toBe(true);

    const content = readFileSync(skillPath, 'utf-8');
    expect(content).toContain('name: sf-test-area');
    expect(content).toContain('## Identity');
    expect(content).toContain('## How to Answer Questions');
    expect(content).toContain('sf-docs/dist/cli.js search');
    expect(content).toContain('## Reference Summary');
    expect(content).toContain('Key Feature');
  });

  test('generateSkill respects custom output path', () => {
    const customPath = join(tmpDir, 'custom', 'MY_SKILL.md');
    const generator = new Generator(registry, store, outputDir);
    const skillPath = generator.generateSkill('test-area', customPath);
    expect(skillPath).toBe(customPath);
    expect(existsSync(customPath)).toBe(true);
  });

  test('generateAgent creates agent.md and tools.md', () => {
    const generator = new Generator(registry, store, outputDir);
    const agentDir = generator.generateAgent('test-area');
    expect(existsSync(join(agentDir, 'agent.md'))).toBe(true);
    expect(existsSync(join(agentDir, 'tools.md'))).toBe(true);

    const agentContent = readFileSync(join(agentDir, 'agent.md'), 'utf-8');
    expect(agentContent).toContain('## Role');
    expect(agentContent).toContain('## Domain Knowledge');
    expect(agentContent).toContain('## Workflow');
    expect(agentContent).toContain('## Constraints');
    expect(agentContent).toContain('Key Feature');

    const toolsContent = readFileSync(join(agentDir, 'tools.md'), 'utf-8');
    expect(toolsContent).toContain('search');
    expect(toolsContent).toContain('fetch');
  });

  test('generateSkill throws for unknown crawl name', () => {
    const generator = new Generator(registry, store, outputDir);
    expect(() => generator.generateSkill('nonexistent')).toThrow('No registered crawl named "nonexistent"');
  });

  test('generateAgent throws for unknown crawl name', () => {
    const generator = new Generator(registry, store, outputDir);
    expect(() => generator.generateAgent('nonexistent')).toThrow('No registered crawl named "nonexistent"');
  });
});
