// tests/parser.test.ts
import { Parser } from '../src/parser.js';

describe('Parser', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  test('converts simple HTML to markdown', () => {
    const html = '<h1>Title</h1><p>Some content here.</p>';
    const result = parser.htmlToMarkdown(html);
    expect(result).toContain('# Title');
    expect(result).toContain('Some content here.');
  });

  test('preserves code blocks', () => {
    const html = '<pre><code>SELECT Id FROM Account</code></pre>';
    const result = parser.htmlToMarkdown(html);
    expect(result).toContain('SELECT Id FROM Account');
  });

  test('preserves tables', () => {
    const html = '<table><tr><th>Field</th><th>Type</th></tr><tr><td>Name</td><td>String</td></tr></table>';
    const result = parser.htmlToMarkdown(html);
    expect(result).toContain('Field');
    expect(result).toContain('Type');
    expect(result).toContain('Name');
    expect(result).toContain('String');
  });

  test('strips feedback widgets', () => {
    const html = '<div class="article-content"><p>Useful content</p></div><div class="article-feedback">Was this helpful?</div>';
    const result = parser.htmlToMarkdown(html);
    expect(result).toContain('Useful content');
    expect(result).not.toContain('Was this helpful');
  });

  test('extracts article ID from URL', () => {
    const url = 'https://help.salesforce.com/s/articleView?id=commerce.comm_pas.htm&type=5';
    expect(parser.extractArticleId(url)).toBe('commerce.comm_pas');
  });

  test('extracts area from article ID', () => {
    expect(parser.extractArea('commerce.comm_pas')).toBe('commerce');
    expect(parser.extractArea('sf.flow_ref')).toBe('sf');
    expect(parser.extractArea('standalone')).toBe('general');
  });

  test('builds article object from parsed data', () => {
    const result = parser.buildArticle({
      html: '<h1>Test Article</h1><p>Content here.</p>',
      title: 'Test Article',
      url: 'https://help.salesforce.com/s/articleView?id=sf.test_article.htm&type=5',
    });
    expect(result.id).toBe('sf.test_article');
    expect(result.area).toBe('sf');
    expect(result.title).toBe('Test Article');
    expect(result.content).toContain('Content here.');
  });
});
