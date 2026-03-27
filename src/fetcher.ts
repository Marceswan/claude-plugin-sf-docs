// src/fetcher.ts
import { chromium, Browser } from 'playwright';
import { PAGE_TIMEOUT_MS, SELECTOR_TIMEOUT_MS, FETCH_DELAY_MS } from './config.js';
import type { RawPage } from './parser.js';

// Selectors for the actual article body content on SF Help.
// SF uses an Aura/Lightning app — content renders inside these containers.
// Tried in order; first match with substantive content wins.
const CONTENT_SELECTORS = [
  '.slds-text-longform',
  '.article-content',
  '.slds-rich-text-editor__output',
  '.content-body',
];

// Elements to remove from the DOM before extracting content.
// These are banners, overlays, chatbots, and other non-article noise.
const ELEMENTS_TO_REMOVE = [
  '.embedded-messaging',                    // Agentforce chatbot
  'iframe[name="embeddedMessagingSiteContextFrame"]',
  '.embeddedMessagingBootstrapScript',
  '.forceCommunityToastManager',            // Toast notifications
  '.banner-header',                         // Cookie/promo banners
  '.banner-actions-container',
  '[class*="cookie"]',                      // Cookie consent
  '[class*="consent"]',
  '.auraErrorBox',                          // Aura error overlays
  '.auraForcedErrorBox',
  '.auraMsgBox',
];

export class Fetcher {
  private browser: Browser | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleTimeoutMs = 60_000;

  async ensureBrowser(): Promise<Browser> {
    this.resetIdleTimer();
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async fetchPage(url: string): Promise<RawPage> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

      // Step 1: Dismiss cookie consent banner if present
      try {
        const acceptBtn = await page.$('text=Accept All Cookies');
        if (acceptBtn) {
          await acceptBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch {
        // No cookie banner — continue
      }

      // Step 2: Wait for the Aura app to fully render the article
      // SF's Lightning/Aura framework renders async — wait for networkidle
      await page.waitForLoadState('networkidle', { timeout: PAGE_TIMEOUT_MS });

      // Step 3: Give the Aura app extra time to hydrate content
      // SF pages often need a beat after networkidle for content injection
      await page.waitForTimeout(2000);

      // Step 4: Remove noise elements from the DOM before extraction
      await page.evaluate((selectors: string[]) => {
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => el.remove());
        }
      }, ELEMENTS_TO_REMOVE);

      // Step 5: Try to extract article content using known selectors
      let contentHtml: string | null = null;
      for (const selector of CONTENT_SELECTORS) {
        try {
          const elements = await page.$$(selector);
          if (elements.length === 0) continue;

          // Concatenate all matching elements (some pages have multiple content sections)
          const parts: string[] = [];
          for (const el of elements) {
            const html = await el.innerHTML();
            if (html && html.trim().length > 50) {
              parts.push(html);
            }
          }

          if (parts.length > 0) {
            contentHtml = parts.join('\n\n');
            break;
          }
        } catch {
          continue;
        }
      }

      // Step 6: Fallback — grab all list items and paragraphs from the page body
      // This catches content even when SF changes their container classes
      if (!contentHtml || contentHtml.length < 200) {
        const fallbackHtml = await page.evaluate(() => {
          const contentParts: string[] = [];

          // Grab substantive paragraphs (not in nav, footer, banner)
          document.querySelectorAll('p, li.slds-p-bottom_small').forEach(el => {
            const text = el.textContent?.trim() || '';
            const parent = el.closest('nav, footer, .banner-header, .forceCommunityToastManager');
            if (text.length > 40 && !parent) {
              contentParts.push(el.outerHTML);
            }
          });

          return contentParts.join('\n');
        });

        if (fallbackHtml && fallbackHtml.length > 200) {
          contentHtml = fallbackHtml;
        }
      }

      if (!contentHtml || contentHtml.length < 100) {
        throw new Error(`Could not extract substantive content from ${url}`);
      }

      // Extract the page title (SF often puts the article title in the page title)
      const title = await page.title();

      return { html: contentHtml, title, url };
    } finally {
      await page.close();
    }
  }

  async fetchWithRetry(url: string): Promise<RawPage> {
    try {
      return await this.fetchPage(url);
    } catch (err) {
      console.error(`First attempt failed for ${url}, retrying...`);
      await this.delay(FETCH_DELAY_MS);
      return await this.fetchPage(url);
    }
  }

  async delay(ms: number = FETCH_DELAY_MS): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => void this.close(), this.idleTimeoutMs);
  }
}
