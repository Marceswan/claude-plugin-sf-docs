// src/chunker.ts
import { getEncoding } from 'js-tiktoken';
import { CHUNK_TARGET_TOKENS, CHUNK_OVERLAP_TOKENS, CHUNK_MAX_TOKENS } from './config.js';

export interface ChunkMetadata {
  articleId: string;
  title: string;
  url: string;
  area: string;
  heading: string;
  chunkIndex: number;
}

export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

interface ChunkerOptions {
  targetTokens?: number;
  overlapTokens?: number;
  maxTokens?: number;
}

interface ArticleMeta {
  id: string;
  title: string;
  url: string;
  area: string;
}

interface Section {
  heading: string;
  content: string;
}

export class Chunker {
  private targetTokens: number;
  private overlapTokens: number;
  private maxTokens: number;
  private encoder: ReturnType<typeof getEncoding>;

  constructor(options: ChunkerOptions = {}) {
    this.targetTokens = options.targetTokens ?? CHUNK_TARGET_TOKENS;
    this.overlapTokens = options.overlapTokens ?? CHUNK_OVERLAP_TOKENS;
    this.maxTokens = options.maxTokens ?? CHUNK_MAX_TOKENS;
    this.encoder = getEncoding('cl100k_base'); // Matches text-embedding-3-small tokenizer
  }

  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }

  chunk(markdown: string, meta: ArticleMeta): Chunk[] {
    const sections = this.splitBySections(markdown);
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionTokens = this.countTokens(section.content);

      if (sectionTokens <= this.targetTokens) {
        chunks.push({
          text: section.content,
          metadata: {
            articleId: meta.id, title: meta.title, url: meta.url,
            area: meta.area, heading: section.heading, chunkIndex: chunkIndex++,
          },
        });
      } else {
        const subChunks = this.splitByParagraphs(section.content, section.heading, meta);
        for (const sc of subChunks) {
          chunks.push({ ...sc, metadata: { ...sc.metadata, chunkIndex: chunkIndex++ } });
        }
      }
    }

    if (chunks.length === 0) {
      chunks.push({
        text: markdown,
        metadata: {
          articleId: meta.id, title: meta.title, url: meta.url,
          area: meta.area, heading: meta.title, chunkIndex: 0,
        },
      });
    }

    return chunks;
  }

  private splitBySections(markdown: string): Section[] {
    const lines = markdown.split('\n');
    const sections: Section[] = [];
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
        }
        currentHeading = headingMatch[1];
        currentContent = [line];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
    }

    return sections;
  }

  private splitByParagraphs(text: string, heading: string, meta: ArticleMeta): Chunk[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const para of paragraphs) {
      const paraTokens = this.countTokens(para);

      if (paraTokens > this.maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.join('\n\n'),
            metadata: {
              articleId: meta.id, title: meta.title, url: meta.url,
              area: meta.area, heading, chunkIndex: 0,
            },
          });
          currentChunk = [];
          currentTokens = 0;
        }
        chunks.push({
          text: para.substring(0, this.maxTokens * 4),
          metadata: {
            articleId: meta.id, title: meta.title, url: meta.url,
            area: meta.area, heading, chunkIndex: 0,
          },
        });
        continue;
      }

      if (currentTokens + paraTokens > this.targetTokens && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.join('\n\n'),
          metadata: {
            articleId: meta.id, title: meta.title, url: meta.url,
            area: meta.area, heading, chunkIndex: 0,
          },
        });
        const lastPara = currentChunk[currentChunk.length - 1];
        currentChunk = [lastPara];
        currentTokens = this.countTokens(lastPara);
      }

      currentChunk.push(para);
      currentTokens += paraTokens;
    }

    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n\n'),
        metadata: {
          articleId: meta.id, title: meta.title, url: meta.url,
          area: meta.area, heading, chunkIndex: 0,
        },
      });
    }

    return chunks;
  }
}
