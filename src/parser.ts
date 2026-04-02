// src/parser.ts
import TurndownService from 'turndown';
import type { Article } from './store.js';

const STRIP_SELECTORS = [
  '.article-feedback',
  '.feedback-container',
  '[class*="cookie"]',
  '[class*="consent"]',
  '.was-this-helpful',
  '.csat-feedback',
];

export interface RawPage {
  html: string;
  title: string;
  url: string;
}

export class Parser {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    // Keep tables readable
    this.turndown.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  }

  htmlToMarkdown(html: string): string {
    let cleaned = html;
    for (const selector of STRIP_SELECTORS) {
      const classMatch = selector.match(/\.([\w-]+)/);
      if (classMatch) {
        const className = classMatch[1];
        const regex = new RegExp(
          `<[^>]*class="[^"]*${className}[^"]*"[^>]*>[\\s\\S]*?<\\/[^>]+>`,
          'gi'
        );
        cleaned = cleaned.replace(regex, '');
      }
    }

    return this.turndown.turndown(cleaned).trim();
  }

  extractArticleId(url: string): string {
    // help.salesforce.com: ?id=sf.field_name.htm -> sf.field_name
    const helpMatch = url.match(/[?&]id=([^&]+)/);
    if (helpMatch) return helpMatch[1].replace(/\.htm$/, '');

    // developer.salesforce.com: /docs/ai/agentforce/guide/agent-script.html
    const devMatch = url.match(/developer\.salesforce\.com\/docs\/(.+?)\.html/);
    if (devMatch) return devMatch[1].replace(/\//g, '.');

    return '';
  }

  extractArea(articleId: string): string {
    const dotIndex = articleId.indexOf('.');
    return dotIndex > 0 ? articleId.substring(0, dotIndex) : 'general';
  }

  isDeveloperDocs(url: string): boolean {
    return url.includes('developer.salesforce.com/docs/');
  }

  buildArticle(raw: RawPage): Article {
    const id = this.extractArticleId(raw.url);
    const area = this.extractArea(id);
    const content = this.htmlToMarkdown(raw.html);

    return {
      id,
      title: raw.title,
      url: raw.url,
      area,
      content,
      fetchedAt: new Date(),
    };
  }
}
