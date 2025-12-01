// Limpieza de capturas de salud
// Mantiene las últimas N capturas y elimina las más antiguas por TTL
const fs = require('fs');
const path = require('path');

const CAPTURE_DIR = path.join(process.cwd(), 'captures');
const MAX_FILES = process.env.CAPTURE_MAX_FILES ? Number(process.env.CAPTURE_MAX_FILES) : 200;
const TTL_DAYS = process.env.CAPTURE_TTL_DAYS ? Number(process.env.CAPTURE_TTL_DAYS) : 7;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

function isHealthCapture(fileName) {
  return fileName.startsWith('health-') && fileName.endsWith('.json');
}

function cleanupCaptures() {
  try {
    if (!fs.existsSync(CAPTURE_DIR)) return;
    const entries = fs.readdirSync(CAPTURE_DIR)
      .filter((f) => isHealthCapture(f))
      .map((f) => {
        const full = path.join(CAPTURE_DIR, f);
        const stat = fs.statSync(full);
        return { name: f, full, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs); // más recientes primero

    const now = Date.now();
    const toDelete = [];

    // Regla 1: eliminar por TTL
    for (const e of entries) {
      if (now - e.mtimeMs > TTL_MS) {
        toDelete.push(e);
      }
    }

    // Regla 2: mantener solo las últimas MAX_FILES
    if (entries.length - toDelete.length > MAX_FILES) {
      const excess = (entries.length - toDelete.length) - MAX_FILES;
      const remaining = entries.filter((e) => !toDelete.includes(e));
      const tail = remaining.slice(MAX_FILES, MAX_FILES + excess);
      toDelete.push(...tail);
    }

    for (const e of toDelete) {
      try { fs.unlinkSync(e.full); } catch (_) {}
    }
  } catch (_) {
    // Silenciar errores de limpieza
  }
}

module.exports = { cleanupCaptures };

