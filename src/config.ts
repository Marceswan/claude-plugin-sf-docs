import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

export const PATHS = {
  root: PROJECT_ROOT,
  docs: resolve(PROJECT_ROOT, 'data', 'docs'),
  index: resolve(PROJECT_ROOT, 'data', 'index'),
  crawls: resolve(PROJECT_ROOT, 'data', '_crawls.json'),
  generated: resolve(PROJECT_ROOT, 'data', 'generated'),
} as const;

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

export const STALENESS_DAYS = 30;
export const CHUNK_TARGET_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;
export const CHUNK_MAX_TOKENS = 8000;
export const SEARCH_TOP_K = 5;
export const FETCH_DELAY_MS = 1500;
export const PAGE_TIMEOUT_MS = 30000;
export const SELECTOR_TIMEOUT_MS = 10000;
