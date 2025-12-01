import { Router } from 'express';
import { JinaService } from '../services/jinaService';

const router = Router();

// Salud de configuración de Jina AI
router.get('/health', (req, res) => {
  const ok = JinaService.isConfigured();
  res.json({ ok, model: JinaService.model });
});

// Generar embeddings de texto (protegido opcionalmente por token si se requiere)
router.post('/embed', async (req, res) => {
  try {
    const text = (req.body?.text || '').toString();
    if (!text || text.length < 1) {
      return res.status(400).json({ error: 'text requerido' });
    }
    const vector = await JinaService.embedText(text);
    res.json({ vector, dim: vector.length, model: JinaService.model });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error al generar embeddings' });
  }
});

export default router;
