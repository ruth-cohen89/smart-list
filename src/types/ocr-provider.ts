export interface OcrProvider {
  extractText(buffer: Buffer, opts?: { lang?: string }): Promise<{ rawText: string }>;
}
