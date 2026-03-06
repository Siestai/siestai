import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const MAX_BATCH_SIZE = 100;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — embedding calls will fail');
    }
  }

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > MAX_BATCH_SIZE) {
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
        const batch = texts.slice(i, i + MAX_BATCH_SIZE);
        const batchResults = await this.embedBatch(batch);
        results.push(...batchResults);
      }
      return results;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`OpenAI embeddings API error: ${response.status} ${body}`);
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((item: { embedding: number[] }) => item.embedding);
  }
}
