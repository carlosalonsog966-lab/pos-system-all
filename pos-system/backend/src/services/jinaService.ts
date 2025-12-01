import axios from 'axios';

export class JinaService {
  static get apiKey(): string | undefined {
    return process.env.JINA_API_KEY || process.env.JINA_TOKEN || undefined;
  }

  static get model(): string {
    return process.env.JINA_MODEL || 'jina-embeddings-v2-base-es';
  }

  static isConfigured(): boolean {
    return !!this.apiKey;
  }

  static async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) throw new Error('JINA_API_KEY no configurado');
    const url = process.env.JINA_API_URL || 'https://api.jina.ai/v1/embeddings';
    const payload = { input: text, model: this.model } as any;
    const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    const resp = await axios.post(url, payload, { headers });
    const data = resp?.data;
    // Formato esperado: { data: [{ embedding: number[] }] }
    const vector = data?.data?.[0]?.embedding || data?.embedding || [];
    if (!Array.isArray(vector) || vector.length < 8) throw new Error('Respuesta inválida al generar embeddings');
    return vector.map((v: any) => Number(v));
  }
}

export default JinaService;
