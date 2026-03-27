// src/vectorIndex.ts
import { LocalIndex } from 'vectra';
import { PATHS, SEARCH_TOP_K } from './config.js';
import { Embeddings } from './embeddings.js';
import { Chunker, Chunk } from './chunker.js';
import type { Article } from './store.js';

export interface SearchResult {
  score: number;
  text: string;
  metadata: Chunk['metadata'];
}

export class VectorIndex {
  private index: LocalIndex;
  private embeddings: Embeddings;
  private chunker: Chunker;

  constructor() {
    this.index = new LocalIndex(PATHS.index);
    this.embeddings = new Embeddings();
    this.chunker = new Chunker();
  }

  async ensureIndex(): Promise<void> {
    if (!await this.index.isIndexCreated()) {
      await this.index.createIndex();
    }
  }

  async addDocument(article: Article): Promise<number> {
    await this.ensureIndex();
    await this.remove(article.id);

    const chunks = this.chunker.chunk(article.content, {
      id: article.id,
      title: article.title,
      url: article.url,
      area: article.area,
    });

    const texts = chunks.map(c => c.text);
    const vectors = await this.embeddings.embedBatch(texts);

    for (let i = 0; i < chunks.length; i++) {
      await this.index.insertItem({
        vector: vectors[i],
        metadata: { ...chunks[i].metadata, text: chunks[i].text },
      });
    }

    return chunks.length;
  }

  async search(query: string, topK: number = SEARCH_TOP_K): Promise<SearchResult[]> {
    await this.ensureIndex();
    const queryVector = await this.embeddings.embed(query);
    const results = await this.index.queryItems(queryVector, topK);

    return results.map(r => ({
      score: r.score,
      text: (r.item.metadata as Record<string, unknown>).text as string,
      metadata: {
        articleId: (r.item.metadata as Record<string, unknown>).articleId as string,
        title: (r.item.metadata as Record<string, unknown>).title as string,
        url: (r.item.metadata as Record<string, unknown>).url as string,
        area: (r.item.metadata as Record<string, unknown>).area as string,
        heading: (r.item.metadata as Record<string, unknown>).heading as string,
        chunkIndex: (r.item.metadata as Record<string, unknown>).chunkIndex as number,
      },
    }));
  }

  async remove(articleId: string): Promise<void> {
    await this.ensureIndex();
    const allItems = await this.index.listItems();
    for (const item of allItems) {
      if ((item.metadata as Record<string, unknown>).articleId === articleId) {
        await this.index.deleteItem(item.id);
      }
    }
  }

  async rebuild(articles: Article[]): Promise<{ totalChunks: number }> {
    if (await this.index.isIndexCreated()) {
      await this.index.deleteIndex();
    }
    await this.index.createIndex();

    let totalChunks = 0;
    for (const article of articles) {
      const count = await this.addDocument(article);
      totalChunks += count;
      console.log(`  Indexed: ${article.title} (${count} chunks)`);
    }
    return { totalChunks };
  }

  async stats(): Promise<{ itemCount: number }> {
    await this.ensureIndex();
    const items = await this.index.listItems();
    return { itemCount: items.length };
  }
}
