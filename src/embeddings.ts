// src/embeddings.ts
import { pipeline } from '@huggingface/transformers';
import { EMBEDDING_MODEL } from './config.js';

export class Embeddings {
  private extractor: any = null;

  private async getExtractor(): Promise<any> {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
        dtype: 'fp32',
      });
    }
    return this.extractor;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const extractor = await this.getExtractor();
    const results: number[][] = [];

    for (const text of texts) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      results.push(Array.from(output.data as Float32Array));
    }

    return results;
  }
}
