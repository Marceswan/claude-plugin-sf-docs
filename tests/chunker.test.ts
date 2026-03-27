// tests/chunker.test.ts
import { Chunker } from '../src/chunker.js';

describe('Chunker', () => {
  let chunker: Chunker;

  beforeEach(() => {
    chunker = new Chunker({ targetTokens: 100, overlapTokens: 10, maxTokens: 8000 });
  });

  test('short document produces single chunk', () => {
    const chunks = chunker.chunk('Short content.', {
      id: 'test.article',
      title: 'Test',
      url: 'https://example.com',
      area: 'test',
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Short content.');
    expect(chunks[0].metadata.articleId).toBe('test.article');
  });

  test('long document produces multiple chunks', () => {
    const sections = Array.from({ length: 10 }, (_, i) =>
      `## Section ${i}\n\n${'This is a paragraph with enough words to take up some tokens. '.repeat(5)}`
    ).join('\n\n');

    const chunks = chunker.chunk(sections, {
      id: 'test.long',
      title: 'Long Article',
      url: 'https://example.com',
      area: 'test',
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('chunks preserve heading context', () => {
    const content = '## Configuration\n\nSet up the gateway.\n\n## Troubleshooting\n\nCheck the logs.';
    const chunks = chunker.chunk(content, {
      id: 'test.headings',
      title: 'Test',
      url: 'https://example.com',
      area: 'test',
    });
    for (const chunk of chunks) {
      expect(chunk.metadata.heading).toBeDefined();
    }
  });

  test('chunks carry parent metadata', () => {
    const chunks = chunker.chunk('Some content.', {
      id: 'commerce.comm_pas',
      title: 'Payment Setup',
      url: 'https://example.com',
      area: 'commerce',
    });
    expect(chunks[0].metadata.articleId).toBe('commerce.comm_pas');
    expect(chunks[0].metadata.title).toBe('Payment Setup');
    expect(chunks[0].metadata.area).toBe('commerce');
    expect(chunks[0].metadata.url).toBe('https://example.com');
  });

  test('countTokens returns reasonable count', () => {
    const count = chunker.countTokens('Hello world');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });
});
