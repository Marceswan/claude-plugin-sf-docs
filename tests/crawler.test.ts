import { extractArticleLinks, isInScope } from '../src/crawler.js';

describe('Crawler utilities', () => {
  test('extracts SF article links from HTML', () => {
    const html = `
      <a href="/s/articleView?id=commerce.comm_gw.htm&type=5">Gateway</a>
      <a href="/s/articleView?id=commerce.comm_pay.htm&type=5">Payments</a>
      <a href="https://example.com/other">External</a>
      <a href="/s/articleView?id=sf.other_topic.htm&type=5">Other SF</a>
    `;
    const links = extractArticleLinks(html, 'https://help.salesforce.com');
    expect(links).toHaveLength(3);
    expect(links).toContain('https://help.salesforce.com/s/articleView?id=commerce.comm_gw.htm&type=5');
    expect(links).toContain('https://help.salesforce.com/s/articleView?id=commerce.comm_pay.htm&type=5');
    expect(links).toContain('https://help.salesforce.com/s/articleView?id=sf.other_topic.htm&type=5');
  });

  test('deduplicates links', () => {
    const html = `
      <a href="/s/articleView?id=commerce.comm_gw.htm&type=5">Link 1</a>
      <a href="/s/articleView?id=commerce.comm_gw.htm&type=5">Link 2</a>
    `;
    const links = extractArticleLinks(html, 'https://help.salesforce.com');
    expect(links).toHaveLength(1);
  });

  test('isInScope matches same area prefix', () => {
    expect(isInScope('commerce.comm_gw', 'commerce')).toBe(true);
    expect(isInScope('commerce.comm_pay', 'commerce')).toBe(true);
    expect(isInScope('sf.other_topic', 'commerce')).toBe(false);
    expect(isInScope('standalone', 'commerce')).toBe(false);
  });

  test('isInScope with general area', () => {
    expect(isInScope('standalone', 'general')).toBe(true);
    expect(isInScope('commerce.something', 'general')).toBe(false);
  });
});
