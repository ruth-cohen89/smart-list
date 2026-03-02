import { ImageAnnotatorClient } from '@google-cloud/vision';
import { AppError } from '../../errors/app-error';
import type { OcrProvider } from '../../types/ocr-provider';

function buildClient(): ImageAnnotatorClient {
  // Preferred (local/dev): GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
  // Also supports ADC in GCP environments.

  // Optional: allow passing the Service Account JSON via env (less recommended).
  const credentialsEnv = process.env.GOOGLE_VISION_CREDENTIALS?.trim();
  if (credentialsEnv) {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(credentialsEnv) as Record<string, unknown>;
    } catch {
      throw new Error('GOOGLE_VISION_CREDENTIALS is not valid JSON');
    }
    return new ImageAnnotatorClient({ credentials });
  }

  return new ImageAnnotatorClient();
}

export class GoogleVisionOcrProvider implements OcrProvider {
  private clientInstance?: ImageAnnotatorClient;

  private get client(): ImageAnnotatorClient {
    if (!this.clientInstance) {
      this.clientInstance = buildClient();
    }
    return this.clientInstance;
  }

  async extractText(buffer: Buffer): Promise<{ rawText: string }> {
    try {
      const [result] = await this.client.documentTextDetection({
        image: { content: buffer },
      });

      const rawText = result.fullTextAnnotation?.text ?? '';
      return { rawText };
    } catch (err) {
      // Log full error internally, never leak credentials to clients.
      console.error('[GoogleVisionOcrProvider] Vision API error:', err);
      throw new AppError('OCR service unavailable', 502);
    }
  }
}
